import express from 'express';
import { request } from 'undici';
import { logger } from '../utils/logger';
import { MetricsService } from '../services/metricsService';

const router: express.Router = express.Router();
const metricsService = new MetricsService();

// Simulator proxy endpoint
router.post('/chat/completions', async (req, res) => {
  const startTime = Date.now(); // Track request start time
  try {
    const { model, messages, max_tokens, tier } = req.body;
    
    // Get authorization header from request
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
    }

    // Determine model and host based on request
    const modelKey = model?.includes('qwen') ? 'qwen3' : 'simulator';
    const hostHeader = modelKey === 'qwen3' ? 'qwen3.maas.local' : 'simulator.maas.local';
    const actualModel = modelKey === 'qwen3' ? 'qwen3-0-6b-instruct' : 'simulator-model';
    
    const requestBody = {
      model: actualModel,
      messages,
      max_tokens
    };

    const requestHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Host': hostHeader
    };

    const kuadrantUrl = process.env.KUADRANT_GATEWAY_URL || 'http://localhost:8080';
    const targetUrl = `${kuadrantUrl}/v1/chat/completions`;

    logger.info('Proxying request to Kuadrant', {
      targetUrl,
      hostHeader,
      model: actualModel,
      tier
    });

    // Use undici to make request with proper Host header support
    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Host': hostHeader  // undici supports setting Host header
      },
      body: JSON.stringify(requestBody)
    };

    logger.info('Making request with Host header using undici', {
      targetUrl,
      hostHeader,
      headers: requestOptions.headers
    });

    // Make request to Kuadrant gateway using undici
    const response = await request(targetUrl, requestOptions);

    const responseText = await response.body.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { error: responseText };
    }

    // Log the response for debugging
    logger.info('Kuadrant response', {
      status: response.statusCode,
      dataLength: responseText.length
    });

    // Add simulator request to metrics for live dashboard
    try {
      const simulatorMetric = metricsService.createSimulatorMetric({
        requestId: `simulator-${Date.now()}-${Math.random()}`,
        model: actualModel,
        team: tier || 'unknown',
        authApiKey: authHeader,
        httpStatus: response.statusCode,
        responseTime: Date.now() - startTime,
        queryText: messages?.[0]?.content || '',
        maxTokens: max_tokens || 0,
        tier: tier || 'free',
        userAgent: req.get('User-Agent') || 'simulator',
        responseData,
        endpoint: '/v1/chat/completions'
      });
      
      metricsService.addSimulatorRequest(simulatorMetric);
      logger.info('Added simulator request to metrics', { requestId: simulatorMetric.id });
    } catch (metricsError) {
      logger.warn('Failed to add simulator request to metrics:', metricsError);
    }

    // Return response with same status code
    res.status(response.statusCode).json({
      success: response.statusCode >= 200 && response.statusCode < 300,
      data: responseData,
      // Include debug info for simulator
      debug: {
        requestUrl: targetUrl,
        requestHeaders: requestOptions.headers,
        requestBody,
        responseStatus: response.statusCode,
        responseHeaders: response.headers,
        note: 'Using undici with proper Host header support'
      }
    });

  } catch (error) {
    logger.error('Simulator proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to proxy request to model server',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;