import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { logger } from './utils/logger';
import metricsRoutes from './routes/metrics';
import policiesRoutes from './routes/policies';
import tokensRoutes from './routes/tokens';
import simulatorRoutes from './routes/simulator';

const app: express.Application = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3001;
const QOS_SERVICE_URL = process.env.QOS_SERVICE_URL || 'http://localhost:3005';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'maas-backend'
  });
});

// API routes
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/policies', policiesRoutes);
app.use('/api/v1/tokens', tokensRoutes);
app.use('/api/v1/simulator', simulatorRoutes);


// QoS proxy endpoints
app.get('/api/v1/qos/metrics', async (req, res) => {
  try {
    const response = await fetch(`${QOS_SERVICE_URL}/metrics`);
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Failed to fetch QoS metrics:', error);
    res.status(500).json({ success: false, error: 'QoS service unavailable' });
  }
});

app.get('/api/v1/qos/health', async (req, res) => {
  try {
    const response = await fetch(`${QOS_SERVICE_URL}/health`);
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Failed to fetch QoS health:', error);
    res.status(500).json({ success: false, error: 'QoS service unavailable' });
  }
});

// Models endpoint - Requires MaaS API configuration
app.get('/api/v1/models', async (req, res) => {
  const USE_LOCAL_MAAS_API = process.env.USE_LOCAL_MAAS_API === 'true';
  const MAAS_API_URL = process.env.MAAS_API_URL;
  
  if (!USE_LOCAL_MAAS_API) {
    return res.status(503).json({
      success: false,
      error: 'MaaS API not enabled',
      details: 'Set USE_LOCAL_MAAS_API=true to enable model discovery'
    });
  }
  
  if (!MAAS_API_URL) {
    return res.status(500).json({
      success: false,
      error: 'MaaS API URL not configured',
      details: 'MAAS_API_URL environment variable is required'
    });
  }
  
  try {
    const axios = require('axios');
    const response = await axios.get(`${MAAS_API_URL}/models`, {
      timeout: 10000
    });
    
    // Transform MaaS API response to frontend format
    const models = response.data?.models || [];
    const transformedModels = models.map((model: any) => ({
      id: model.name,
      name: model.name,
      provider: 'KServe',
      description: `${model.name} Model`,
      namespace: model.namespace,
      url: model.url,
      ready: model.ready
    }));
    
    logger.info(`Retrieved ${transformedModels.length} models from MaaS API`);
    res.json({
      success: true,
      data: transformedModels
    });
  } catch (error: any) {
    logger.error('Failed to fetch models from MaaS API:', error.message);
    res.status(503).json({
      success: false,
      error: 'Failed to fetch models from MaaS API',
      details: error.message
    });
  }
});

// Cluster status endpoint for authentication dialog
app.get('/api/v1/cluster/status', async (req, res) => {
  try {
    // Try to get the actual authenticated user
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    let user = 'authenticated-user';
    try {
      const { stdout } = await execAsync('oc whoami');
      user = stdout.trim();
    } catch (error) {
      logger.warn('Could not get authenticated user via oc whoami');
    }
    
    res.json({
      success: true,
      data: {
        connected: true,
        user: user,
        cluster: process.env.CLUSTER_DOMAIN || 'your-cluster.example.com',
        loginUrl: process.env.REACT_APP_CONSOLE_URL || 'https://console-openshift-console.your-cluster.example.com'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting cluster status:', error);
    res.status(500).json({
      success: false,
      error: 'Could not get cluster status'
    });
  }
});

// User info endpoint - Simple OpenShift user and group lookup
app.get('/api/v1/user', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    let user = 'authenticated-user';
    let groups: string[] = [];
    
    try {
      const { stdout: whoamiOutput } = await execAsync('oc whoami');
      user = whoamiOutput.trim();
      
      // Get user groups by checking group membership directly
      const checkGroups = ['premium-users', 'enterprise-users', 'admin-users'];
      for (const groupName of checkGroups) {
        try {
          const { stdout } = await execAsync(`oc get group ${groupName} -o jsonpath='{.users[*]}' 2>/dev/null`);
          if (stdout && stdout.includes(user)) {
            groups.push(groupName);
            logger.info(`User ${user} is member of group: ${groupName}`);
          }
        } catch (e) {
          // Group doesn't exist or no access - this is normal
        }
      }
      
      // Also check system:authenticated as it's typically included
      groups.push('system:authenticated');
      logger.info(`Found user groups for ${user}: ${groups.join(', ')}`);
    } catch (error) {
      logger.warn('Could not get user info via oc commands');
    }
    
    // Simple tier determination based on OpenShift groups
    let tier = 'free'; // default
    if (groups.includes('premium-users')) {
      tier = 'premium';
    } else if (groups.includes('enterprise-users') || groups.includes('admin-users')) {
      tier = 'enterprise';
    }
    
    const userInfo = {
      id: user,
      name: user,
      email: `${user}@${process.env.CLUSTER_DOMAIN || 'cluster.local'}`,
      tier: tier,
      groups: groups,
      namespace: `maas-billing-tier-${tier}`,
      cluster: process.env.CLUSTER_DOMAIN || 'your-cluster.example.com'
    };
    
    res.json({
      success: true,
      data: userInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Error getting user info:', error);
    res.status(500).json({
      success: false,
      error: 'Could not get user information',
      details: error.message
    });
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// QoS Service integration
let qosClient: any = null;

function connectToQoSService() {
  try {
    qosClient = SocketIOClient(QOS_SERVICE_URL);
    
    qosClient.on('connect', () => {
      logger.info('Connected to QoS service', { url: QOS_SERVICE_URL });
    });
    
    qosClient.on('disconnect', () => {
      logger.warn('Disconnected from QoS service');
    });
    
    qosClient.on('connect_error', (error: any) => {
      logger.error('QoS service connection error:', error);
    });
    
    // Forward QoS events to frontend clients
    qosClient.on('queue_update', (data: any) => {
      io.emit('qos_queue_update', data);
    });
    
    qosClient.on('queue_stats', (data: any) => {
      io.emit('qos_queue_stats', data);
    });
    
    qosClient.on('request_queued', (data: any) => {
      io.emit('qos_request_queued', data);
    });
    
    qosClient.on('request_completed', (data: any) => {
      io.emit('qos_request_completed', data);
    });
    
  } catch (error) {
    logger.error('Failed to connect to QoS service:', error);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Frontend client connected', { 
    socketId: socket.id,
    clientIP: socket.handshake.address 
  });
  
  // Handle QoS monitoring requests
  socket.on('subscribe_qos', () => {
    logger.info('Client subscribed to QoS updates', { socketId: socket.id });
    if (qosClient?.connected) {
      qosClient.emit('get_metrics');
      qosClient.emit('get_detailed_stats');
    }
  });
  
  socket.on('unsubscribe_qos', () => {
    logger.info('Client unsubscribed from QoS updates', { socketId: socket.id });
  });
  
  socket.on('disconnect', () => {
    logger.info('Frontend client disconnected', { socketId: socket.id });
  });
});


// Start server
if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Available endpoints:');
    logger.info('  GET /health - Health check');
    logger.info('  GET /api/v1/models - Available models');
    logger.info('  GET /api/v1/cluster/status - Cluster authentication status');
    logger.info('  GET /api/v1/metrics - General metrics');
    logger.info('  GET /api/v1/metrics/live-requests - Live request data with policy enforcement');
    logger.info('  GET /api/v1/metrics/dashboard - Dashboard statistics');
    logger.info('  GET /api/v1/policies - Get all policies');
    logger.info('  POST /api/v1/policies - Create new policy');
    logger.info('  PUT /api/v1/policies/:id - Update policy');
    logger.info('  DELETE /api/v1/policies/:id - Delete policy');
    logger.info('  GET /api/v1/tokens/user/tier - Get user tier information');
    logger.info('  GET /api/v1/tokens - Get user tokens');
    logger.info('  POST /api/v1/tokens/create - Create new token');
    logger.info('  DELETE /api/v1/tokens/:name - Revoke token');
    logger.info('  POST /api/v1/tokens/test - Test token authentication');
    logger.info('  GET /api/v1/qos/metrics - QoS metrics proxy');
    logger.info('  GET /api/v1/qos/health - QoS health proxy');
    logger.info('Socket.IO server enabled for real-time updates');
    
    // Connect to QoS service after server starts
    connectToQoSService();
  });
}

export default app;