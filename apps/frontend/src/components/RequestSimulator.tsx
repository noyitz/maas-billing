import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
} from '@mui/icons-material';

const RequestSimulator: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleRunSimulation = () => {
    setIsRunning(true);
    // Simple simulation
    setTimeout(() => {
      setResults([
        {
          id: 1,
          timestamp: new Date().toISOString(),
          decision: 'accept',
          reason: 'Request approved',
          model: 'test-model'
        }
      ]);
      setIsRunning(false);
    }, 1000);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Request Simulator
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Test your policies by simulating requests and seeing how they would be handled by Kuadrant.
      </Typography>
      
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2">
          <strong>Simplified Version:</strong><br />
          This is a minimal working version to test component loading.
        </Typography>
      </Alert>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simulation Configuration
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Query Text"
                    placeholder="Enter the request you want to simulate..."
                    multiline
                    rows={3}
                    size="small"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<PlayIcon />}
                      onClick={handleRunSimulation}
                      disabled={isRunning}
                      size="large"
                    >
                      {isRunning ? 'Running...' : 'Run Simulation'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
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