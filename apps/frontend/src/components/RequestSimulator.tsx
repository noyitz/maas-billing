import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Stack,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  SmartToy as ModelIcon,
  Group as TierIcon,
} from '@mui/icons-material';

import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';

interface Model {
  id: string;
  name: string;
  endpoint: string;
  description: string;
}

interface Tier {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  limits: string;
}

const RequestSimulator: React.FC = () => {
  const { mode } = useTheme();
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [queryText, setQueryText] = useState('Hello, how can you help me today?');
  const [maxTokens, setMaxTokens] = useState(100);
  const [numRequests, setNumRequests] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [availableTiers, setAvailableTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);

  // Available models from cluster
  const availableModels: Model[] = [
    {
      id: 'vllm-simulator',
      name: 'vLLM Simulator',
      endpoint: 'http://simulator-llm.apps.summit-gpu.octo-emerging.redhataicoe.com',
      description: 'Test model for policy enforcement simulation'
    },
    {
      id: 'qwen3-0-6b-instruct',
      name: 'Qwen3 0.6B Instruct',
      endpoint: 'http://qwen3-llm.apps.summit-gpu.octo-emerging.redhataicoe.com',
      description: 'Qwen3 model with vLLM runtime'
    }
  ];

  // Load tiers dynamically from backend policies
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setTiersLoading(true);
        // Fetch policies from backend
        const policies = await apiService.getPolicies();
        console.log('Fetched policies:', policies);
        
        // Extract tiers from auth policy allowedGroups
        const tierSet = new Set<string>();
        
        policies.forEach((policy: any) => {
          // Look for auth policies with allowedGroups
          if (policy.type === 'auth' && policy.items) {
            policy.items.forEach((item: any) => {
              if (item.allowedGroups && Array.isArray(item.allowedGroups)) {
                item.allowedGroups.forEach((group: string) => {
                  tierSet.add(group);
                });
              }
            });
          }
        });
        
        // Convert to tier objects
        const tiersArray: Tier[] = Array.from(tierSet).map(tierId => ({
          id: tierId,
          name: tierId.split('-').map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          description: `${tierId} tier from auth policy`,
          apiKey: `${tierId}_key`,
          limits: 'Policy-based limits'
        }));
        
        // Add an invalid tier for testing
        tiersArray.push({
          id: 'invalid',
          name: 'Invalid Key',
          description: 'Invalid API key to test auth failures',
          apiKey: '',
          limits: 'No access'
        });
        
        console.log('Built tiers from policies:', tiersArray);
        setAvailableTiers(tiersArray);
      } catch (error) {
        console.error('Failed to fetch tiers from policies:', error);
        // Fallback to basic tiers if API fails
        setAvailableTiers([
          {
            id: 'free',
            name: 'Free Tier',
            description: 'Default free tier',
            apiKey: 'free_key',
            limits: 'Basic limits'
          },
          {
            id: 'premium',
            name: 'Premium Tier',
            description: 'Default premium tier',
            apiKey: 'premium_key',
            limits: 'Higher limits'
          }
        ]);
      } finally {
        setTiersLoading(false);
      }
    };

    fetchTiers();
  }, []);

  const handleRunSimulation = async () => {
    console.log('Starting simulation...');
    
    if (!selectedModel || !selectedTier) {
      console.error('Please select both a model and a tier');
      return;
    }

    setIsRunning(true);
    
    try {
      // Run simulation for the specified number of requests
      const newResults = [];
      for (let i = 1; i <= numRequests; i++) {
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
        newResults.push({
          id: `sim-${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          decision: Math.random() > 0.7 ? 'reject' : 'accept',
          reason: Math.random() > 0.7 ? 'Rate limit exceeded' : 'Request approved',
          model: selectedModel.name,
          tier: selectedTier.name
        });
      }
      setResults(prev => [...newResults, ...prev]);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsRunning(false);
      console.log('Simulation completed');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Request Simulator
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Test your policies by simulating requests and seeing how they would be handled by Kuadrant.
      </Typography>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        {/* Left Panel - Model and Tier Selection */}
        <Grid item xs={12} md={8}>
          <Card sx={{ minHeight: 'calc(100vh - 200px)' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Select Model and Tier
              </Typography>
              
              <Grid container spacing={3}>
                {/* Model Selection */}
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Available Models
                  </Typography>
                  <Stack spacing={2}>
                    {availableModels.map((model) => (
                      <Paper
                        key={model.id}
                        onClick={() => setSelectedModel(model)}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          background: selectedModel?.id === model.id 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'background.default',
                          color: selectedModel?.id === model.id ? 'white' : 'text.primary',
                          border: selectedModel?.id === model.id ? 'none' : '1px solid',
                          borderColor: 'divider',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <ModelIcon />
                          <Box>
                            <Typography variant="body1" fontWeight="600">
                              {model.name}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                              {model.description}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </Grid>

                {/* Tier Selection */}
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Available Tiers
                  </Typography>
                  {tiersLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                        Loading tiers from policies...
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ flexGrow: 1, overflow: 'auto', maxHeight: '400px' }}>
                      <Stack spacing={2}>
                      {availableTiers.map((tier) => (
                        <Paper
                          key={tier.id}
                          onClick={() => setSelectedTier(tier)}
                          sx={{
                            p: 2,
                            cursor: 'pointer',
                            background: selectedTier?.id === tier.id 
                              ? tier.id === 'invalid' 
                                ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
                                : tier.id === 'test-tokens-blue'
                                ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                                : tier.id === 'test-tokens-green'
                                ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
                                : tier.id.startsWith('test-tokens')
                                ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                                : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
                              : 'background.default',
                            color: selectedTier?.id === tier.id 
                              ? tier.id === 'invalid' || tier.id.startsWith('test-tokens') ? 'white' : 'text.primary'
                              : 'text.primary',
                            border: selectedTier?.id === tier.id ? 'none' : '1px solid',
                            borderColor: 'divider',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <TierIcon />
                            <Box>
                              <Typography variant="body1" fontWeight="600">
                                {tier.name}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                {tier.limits}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                      </Stack>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Configuration */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Request Configuration
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  fullWidth
                  label="Query Text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  multiline
                  rows={4}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      bgcolor: mode === 'dark' ? 'grey.900' : 'background.default',
                      color: 'text.primary'
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary'
                    }
                  }}
                />
                
                <TextField
                  fullWidth
                  label="Max Tokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      bgcolor: mode === 'dark' ? 'grey.900' : 'background.default',
                      color: 'text.primary'
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary'
                    }
                  }}
                />

                <TextField
                  fullWidth
                  label="Number of Requests"
                  type="number"
                  value={numRequests}
                  onChange={(e) => setNumRequests(parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 50 }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      bgcolor: mode === 'dark' ? 'grey.900' : 'background.default',
                      color: 'text.primary'
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary'
                    }
                  }}
                />

                {selectedModel && selectedTier && (
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Ready:</strong> {selectedModel.name} with {selectedTier.name} tier
                    </Typography>
                  </Alert>
                )}

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                  onClick={handleRunSimulation}
                  disabled={!selectedModel || !selectedTier || isRunning}
                  sx={{
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    background: selectedModel && selectedTier 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%)',
                    '&:hover': {
                      background: selectedModel && selectedTier 
                        ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                        : 'linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%)'
                    }
                  }}
                >
                  {isRunning ? `Running ${numRequests} Requests...` : `Run ${numRequests} Request${numRequests > 1 ? 's' : ''}`}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {results.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Simulation Results
            </Typography>
            
            <Alert severity="success" sx={{ mb: 2 }}>
              Simulation completed successfully! Found {results.length} result(s).
            </Alert>
            
            {results.map((result) => (
              <Box key={result.id} sx={{ mb: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Decision:</strong> {result.decision}<br />
                  <strong>Reason:</strong> {result.reason}<br />
                  <strong>Model:</strong> {result.model}<br />
                  <strong>Tier:</strong> {result.tier}<br />
                  <strong>Time:</strong> {new Date(result.timestamp).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RequestSimulator;