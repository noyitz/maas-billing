import express from 'express';
import { logger } from '../utils/logger';
import axios from 'axios';

const router: express.Router = express.Router();

// MaaS API Configuration - Local Service (new Go-based system)
const MAAS_API_URL = process.env.MAAS_API_URL || 'http://localhost:8080';
const USE_LOCAL_MAAS_API = process.env.USE_LOCAL_MAAS_API === 'true';

// Fallback to old key-manager for compatibility (when USE_LOCAL_MAAS_API=false)
const CLUSTER_DOMAIN = process.env.CLUSTER_DOMAIN || 'your-cluster.example.com';
const KEY_MANAGER_BASE_URL = process.env.KEY_MANAGER_BASE_URL || `https://key-manager-route-platform-services.${CLUSTER_DOMAIN}`;
const ADMIN_KEY = process.env.KEY_MANAGER_ADMIN_KEY || process.env.ADMIN_KEY;

logger.info(`Token service configuration: ${USE_LOCAL_MAAS_API ? 'Using local MaaS API' : 'Using legacy key-manager'}`);
logger.info(`MaaS API URL: ${MAAS_API_URL}`);

// Helper to get OpenShift token for authentication
const getOpenShiftToken = async (): Promise<string> => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('oc whoami -t');
    return stdout.trim();
  } catch (error) {
    logger.error('Failed to get OpenShift token:', error);
    throw new Error('OpenShift authentication required');
  }
};

// Helper function to make requests to MaaS API
const makeMaasApiRequest = async (endpoint: string, options: any = {}) => {
  const url = `${MAAS_API_URL}${endpoint}`;
  const osToken = await getOpenShiftToken();
  
  const headers = {
    'Authorization': `Bearer ${osToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  return axios({
    url,
    method: options.method || 'GET',
    headers,
    data: options.data,
    timeout: 30000,
    ...options
  });
};

// Helper function for legacy key-manager requests (when USE_LOCAL_MAAS_API=false)
const makeKeyManagerRequest = async (endpoint: string, options: any = {}) => {
  const url = `${KEY_MANAGER_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `ADMIN ${ADMIN_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  return axios({
    url,
    method: options.method || 'GET',
    headers,
    data: options.data,
    timeout: 30000,
    httpsAgent: new (require('https').Agent)({
      rejectUnauthorized: false
    }),
    ...options
  });
};




// Create a new API token
router.post('/create', async (req, res) => {
  if (USE_LOCAL_MAAS_API) {
    try {
      const { ttl } = req.body;

      logger.info('Creating Service Account token via MaaS API:', { ttl });
      
      // For Service Account tokens, we use TTL
      // If no TTL provided, let MaaS API use its default (4h)
      const requestData = ttl ? { ttl: ttl } : {};
      
      const response = await makeMaasApiRequest('/v1/tokens', {
        method: 'POST',
        data: requestData
      });
      
      const tokenData = response.data;
      
      res.status(201).json({
        success: true,
        data: tokenData, // Return pure MaaS API response
        message: `Service Account token created successfully (TTL: ${tokenData.ttl})`
      });
    } catch (error: any) {
      logger.error('Failed to create Service Account token via MaaS API:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to create Service Account token',
        details: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    // Legacy key-manager implementation
    try {
      const { name, description, team_id } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Token name is required'
        });
      }

      logger.info('Creating new token via key manager:', { name, description, team_id });
      
      const targetTeamId = team_id || 'default';
      const currentUserId = process.env.DEFAULT_USER_ID || 'noyitz';
      
      const createTokenData = {
        user_id: currentUserId,
        user_email: `${currentUserId}@generated.local`,
        display_name: name,
        description: description || `Token: ${name}`
      };
      
      const response = await makeKeyManagerRequest(`/teams/${targetTeamId}/keys`, {
        method: 'POST',
        data: createTokenData
      });
      
      const tokenData = response.data;
      
      res.status(201).json({
        success: true,
        data: {
          name: tokenData.secret_name || `apikey-${currentUserId}-${targetTeamId}`,
          token: tokenData.api_key || tokenData.secret_name,
          created: new Date().toISOString(),
          team_id: targetTeamId,
          user_id: currentUserId
        },
        message: 'Token created successfully via key manager'
      });
    } catch (error: any) {
      logger.error('Failed to create token via key manager:', error);
      
      res.status(503).json({
        success: false,
        error: 'Key manager service is unavailable',
        details: error.message || 'Unable to connect to key manager service',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Delete all tokens for current user
router.delete('/delete', async (req, res) => {
  if (USE_LOCAL_MAAS_API) {
    try {
      logger.info('Deleting all tokens via MaaS API');
      
      // Call MaaS API to delete all tokens
      await makeMaasApiRequest('/v1/tokens', {
        method: 'DELETE'
      });
      
      logger.info('Tokens deleted successfully via MaaS API');
      res.json({
        success: true,
        message: 'All tokens revoked successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Failed to delete tokens via MaaS API:', error);
      
      if (error.response?.status === 401) {
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          details: 'Unable to authenticate with MaaS API',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          success: false,
          error: 'MaaS API service is unavailable',
          details: error.message || 'Unable to connect to MaaS API service',
          timestamp: new Date().toISOString()
        });
      }
    }
  } else {
    // Legacy key manager implementation (not implemented)
    res.status(501).json({
      success: false,
      error: 'Token deletion not supported',
      details: 'Token deletion is only available with MaaS API (USE_LOCAL_MAAS_API=true)',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;