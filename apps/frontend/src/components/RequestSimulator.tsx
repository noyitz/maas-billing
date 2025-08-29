import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Collapse,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
  Memory as ModelIcon,
  Security as TierIcon,
  Numbers as CountIcon,
  Token as TokenIcon,
} from '@mui/icons-material';

import { teams, models } from '../data/mockData';
import { SimulationRequest } from '../types';
import config from '../config/environment';

// Helper function for tier styling
const getTierProps = (tier: string) => {
  switch (tier) {
    case 'free':
      return {
        label: 'Free Tier',
        color: 'success' as const,
        icon: <TierIcon color="success" fontSize="small" />,
        description: 'Basic access with limits'
      };
    case 'premium':
      return {
        label: 'Premium Tier',
        color: 'secondary' as const, // Purple color for premium
        icon: <TierIcon color="secondary" fontSize="small" />,
        description: 'Enhanced access and higher limits'
      };
    case 'none':
      return {
        label: 'No Auth (Test Failure)',
        color: 'error' as const,
        icon: <TierIcon color="error" fontSize="small" />,
        description: 'Empty credentials for testing auth failures'
      };
    default:
      return {
        label: tier,
        color: 'default' as const,
        icon: <TierIcon color="action" fontSize="small" />,
        description: ''
      };
  }
};

// Draggable Item Component
const DraggableItem: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  description?: string;
}> = ({ id, label, icon, color = 'primary', description }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Card
      sx={{
        cursor: 'grab',
        mb: 1,
        '&:active': { cursor: 'grabbing' },
        '&:hover': { bgcolor: 'action.hover' },
        border: `2px solid transparent`,
        transition: 'all 0.2s',
      }}
      draggable
      onDragStart={handleDragStart}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DragIcon color="action" fontSize="small" />
          {icon}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {label}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Drop Zone Component  
const DropZone: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onDrop: (value: string) => void;
  onClear: () => void;
  icon?: React.ReactNode;
}> = ({ label, value, placeholder, onDrop, onClear, icon }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedValue = e.dataTransfer.getData('text/plain');
    onDrop(droppedValue);
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        {label}
      </Typography>
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: `2px dashed ${isDragOver ? '#1976d2' : '#ccc'}`,
          borderRadius: 2,
          p: 2,
          minHeight: 60,
          bgcolor: isDragOver ? 'primary.50' : value ? 'success.50' : 'grey.50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all 0.2s',
        }}
      >
        {value ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
              {value}
            </Typography>
            <Button
              size="small"
              onClick={onClear}
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              ✕
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isDragOver ? 'Drop here' : placeholder}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// Expandable row component for showing request/response details
const RequestRow: React.FC<{ result: any }> = ({ result }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {result.requestNumber || '?'}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {new Date(result.timestamp).toLocaleTimeString()}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{result.model}</Typography>
        </TableCell>
        <TableCell>
          {(() => {
            const tierProps = getTierProps(result.tier);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {tierProps.icon}
                <Chip
                  label={tierProps.label}
                  color={tierProps.color}
                  size="small"
                />
              </Box>
            );
          })()}
        </TableCell>
        <TableCell>
          <Chip
            label={result.decision}
            color={result.decision === 'accept' ? 'success' : 'error'}
            size="small"
          />
        </TableCell>
        <TableCell>
          <Chip
            label={result.policyType}
            color={result.policyType === 'RateLimitPolicy' ? 'warning' : 
                  result.policyType === 'AuthPolicy' ? 'primary' : 
                  result.policyType === 'NetworkError' ? 'error' : 'default'}
            size="small"
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {result.reason}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{result.tokens}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{result.responseTime}ms</Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" color="primary">
                        HTTP Request
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          URL & Method:
                        </Typography>
                        <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {result.requestDetails?.method} {result.requestDetails?.url}
                          </Typography>
                        </Paper>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Headers:
                        </Typography>
                        <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(result.requestDetails?.headers || {}, null, 2)}
                          </Typography>
                        </Paper>
                      </Box>
                      
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Body:
                        </Typography>
                        <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(result.requestDetails?.body || {}, null, 2)}
                          </Typography>
                        </Paper>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" color="secondary">
                        HTTP Response
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Status:
                        </Typography>
                        <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {result.responseDetails?.status} {result.responseDetails?.statusText}
                          </Typography>
                        </Paper>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Headers:
                        </Typography>
                        <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(result.responseDetails?.headers || {}, null, 2)}
                          </Typography>
                        </Paper>
                      </Box>
                      
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Body:
                        </Typography>
                        <Paper sx={{ p: 1, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {result.responseDetails?.body || 'No response body'}
                          </Typography>
                        </Paper>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const RequestSimulator: React.FC = () => {
  const [simulationForm, setSimulationForm] = useState<SimulationRequest>({
    team: 'default', // Set default team since we're removing the selection
    model: '',
    timeOfDay: new Date().toTimeString().slice(0, 5),
    queryText: '',
    count: 1,
    tier: 'free',
    maxTokens: 100,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleInputChange = (field: keyof SimulationRequest, value: any) => {
    setSimulationForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const getApiKeyForTier = (tier: string): string => {
    if (tier === 'none') {
      return ''; // Return empty string for auth failure testing
    }
    return config.API_KEYS[tier as keyof typeof config.API_KEYS] || config.API_KEYS.free;
  };

  const makeOpenAIRequest = async (apiKey: string, model: string, prompt: string, maxTokens: number, tier: string) => {
    const requestBody = {
      model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: maxTokens,
      tier
    };

    const requestHeaders: Record<string, string> = {
      'Authorization': `APIKEY ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Use backend proxy to avoid CORS issues
    const proxyEndpointUrl = `${config.API_BASE_URL}/simulator/chat/completions`;
    
    const response = await fetch(proxyEndpointUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    });

    let responseData = null;
    let responseText = '';
    
    try {
      responseText = await response.text();
      if (response.ok && responseText) {
        responseData = JSON.parse(responseText);
      }
    } catch (e) {
      // Keep responseText as is if not valid JSON
    }

    // Extract debug info from backend response if available
    const debugInfo = responseData?.debug || {};
    
    return {
      status: response.status,
      ok: response.ok,
      data: responseData?.data || responseData,
      error: !response.ok ? (responseData?.error || responseText) : null,
      // Include request details for display
      requestDetails: {
        url: debugInfo.requestUrl || proxyEndpointUrl,
        method: 'POST',
        headers: debugInfo.requestHeaders || requestHeaders,
        body: debugInfo.requestBody || requestBody
      },
      responseDetails: {
        status: debugInfo.responseStatus || response.status,
        statusText: response.statusText,
        headers: debugInfo.responseHeaders || Object.fromEntries(response.headers.entries()),
        body: responseText
      }
    };
  };

  const handleRunSimulation = async () => {
    if (!simulationForm.model || !simulationForm.queryText) {
      return;
    }

    setIsRunning(true);
    setResults([]); // Clear previous results
    const results: any[] = [];
    
    try {
      const apiKey = getApiKeyForTier(simulationForm.tier);
      
      for (let i = 0; i < simulationForm.count; i++) {
        console.log(`Starting request ${i + 1} of ${simulationForm.count}`);
        const startTime = Date.now();
        
        try {
          const response = await makeOpenAIRequest(
            apiKey,
            simulationForm.model,
            simulationForm.queryText,
            simulationForm.maxTokens,
            simulationForm.tier
          );
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          const result = {
            id: `sim-${Date.now()}-${i}`,
            team: simulationForm.team,
            model: simulationForm.model,
            timestamp: new Date().toISOString(),
            decision: response.ok ? 'accept' : 'reject',
            policyType: response.status === 429 ? 'RateLimitPolicy' : response.status === 401 ? 'AuthPolicy' : 'None',
            reason: response.ok ? 'Request approved' : 
                   response.status === 429 ? 'Rate limit exceeded' :
                   response.status === 401 ? 'Authentication failed' :
                   `HTTP ${response.status}: ${response.error}`,
            queryText: simulationForm.queryText,
            tokens: response.ok && response.data?.usage ? response.data.usage.total_tokens : 0,
            responseTime,
            tier: simulationForm.tier,
            maxTokens: simulationForm.maxTokens,
            httpStatus: response.status,
            rawResponse: response.data,
            requestNumber: i + 1,
            // Add detailed request/response information
            requestDetails: response.requestDetails,
            responseDetails: response.responseDetails
          };
          
          results.push(result);
          setResults(prev => [...prev, result]); // Update UI with current results
          
          console.log(`Completed request ${i + 1}, total results: ${results.length}`);
          
          // Small delay between requests to avoid overwhelming the server
          if (i < simulationForm.count - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (requestError) {
          console.error(`Request ${i + 1} failed:`, requestError);
          const result = {
            id: `sim-${Date.now()}-${i}`,
            team: simulationForm.team,
            model: simulationForm.model,
            timestamp: new Date().toISOString(),
            decision: 'reject',
            policyType: 'NetworkError',
            reason: `Network error: ${requestError}`,
            queryText: simulationForm.queryText,
            tokens: 0,
            responseTime: Date.now() - startTime,
            tier: simulationForm.tier,
            maxTokens: simulationForm.maxTokens,
            httpStatus: 0,
            requestNumber: i + 1,
            requestDetails: {
              url: `${config.API_BASE_URL}/simulator/chat/completions`,
              method: 'POST',
              headers: {
                'Authorization': `APIKEY ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: {
                model: simulationForm.model,
                messages: [{
                  role: 'user',
                  content: simulationForm.queryText
                }],
                max_tokens: simulationForm.maxTokens,
                tier: simulationForm.tier
              }
            },
            responseDetails: {
              status: 0,
              statusText: 'Network Error',
              headers: {},
              body: String(requestError)
            }
          };
          
          results.push(result);
          setResults(prev => [...prev, result]);
        }
      }
      
      console.log(`Simulation completed. Total requests: ${results.length}`);
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopSimulation = () => {
    setIsRunning(false);
  };

  const canRunSimulation = simulationForm.model && simulationForm.queryText && simulationForm.tier && !isRunning;

  return (
    <Box>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        Request Simulator
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Test your policies by simulating requests and seeing how they would be handled by Kuadrant.
      </Typography>
      
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2">
          <strong>Current Configuration:</strong><br />
          Proxy through backend: {config.API_BASE_URL}/simulator/chat/completions<br />
          Backend forwards to Kuadrant at localhost:8080 with Host headers
        </Typography>
      </Alert>

      {/* Drag and Drop Interface */}
      <Grid container spacing={4} sx={{ mb: 4 }}>
        {/* Left Panel - Draggable Items */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Options
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Drag items to configure your simulation
              </Typography>
              
              <Stack spacing={2}>
                {/* Models Section */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Models
                  </Typography>
                  {models.map(model => (
                    <DraggableItem
                      key={model.id}
                      id={model.id}
                      label={model.name}
                      description={model.description}
                      icon={<ModelIcon color="primary" fontSize="small" />}
                    />
                  ))}
                </Box>
                
                <Divider />
                
                {/* Tiers Section */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Billing Tiers
                  </Typography>
                  {['free', 'premium', 'none'].map(tierId => {
                    const tierProps = getTierProps(tierId);
                    return (
                      <DraggableItem
                        key={tierId}
                        id={tierId}
                        label={tierProps.label}
                        description={tierProps.description}
                        icon={tierProps.icon}
                      />
                    );
                  })}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Right Panel - Drop Zones */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simulation Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Drop items here to configure your simulation
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <DropZone
                    label="Model"
                    value={simulationForm.model ? models.find(m => m.id === simulationForm.model)?.name || simulationForm.model : ''}
                    placeholder="Drop a model here"
                    onDrop={(value) => handleInputChange('model', value)}
                    onClear={() => handleInputChange('model', '')}
                    icon={<ModelIcon color="primary" fontSize="small" />}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <DropZone
                    label="Billing Tier"
                    value={simulationForm.tier ? getTierProps(simulationForm.tier).label : ''}
                    placeholder="Drop a tier here"
                    onDrop={(value) => handleInputChange('tier', value)}
                    onClear={() => handleInputChange('tier', '')}
                    icon={<TierIcon color="secondary" fontSize="small" />}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CountIcon color="action" fontSize="small" />
                      Request Count
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={simulationForm.count}
                      onChange={(e) => handleInputChange('count', parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1, max: 100 }}
                      size="small"
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TokenIcon color="action" fontSize="small" />
                      Max Tokens
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={simulationForm.maxTokens}
                      onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value) || 100)}
                      inputProps={{ min: 1, max: 4096 }}
                      size="small"
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Query Text
                    </Typography>
                    <TextField
                      fullWidth
                      value={simulationForm.queryText}
                      onChange={(e) => handleInputChange('queryText', e.target.value)}
                      placeholder="Enter the request you want to simulate..."
                      multiline
                      rows={3}
                      size="small"
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<PlayIcon />}
                      onClick={handleRunSimulation}
                      disabled={!canRunSimulation}
                      size="large"
                    >
                      {isRunning ? 'Running...' : 'Run Simulation'}
                    </Button>
                    
                    {isRunning && (
                      <Button
                        variant="outlined"
                        startIcon={<StopIcon />}
                        onClick={handleStopSimulation}
                        color="error"
                        size="large"
                      >
                        Stop
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Simulation Results
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              Making real requests to the OpenAI-compatible API endpoint. Results show actual policy enforcement.
            </Alert>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Request #</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Tier</TableCell>
                    <TableCell>Decision</TableCell>
                    <TableCell>Policy</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Tokens</TableCell>
                    <TableCell align="right">Response Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result) => (
                    <RequestRow key={result.id} result={result} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

// Explicit named export for better compatibility
export { RequestSimulator };

// Default export
export default RequestSimulator;