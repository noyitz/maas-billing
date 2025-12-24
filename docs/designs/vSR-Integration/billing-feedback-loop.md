# Billing Feedback Loop (Future Enhancement)

**Document**: Dynamic Billing Implementation for vSR-MaaS Integration  
**Date**: December 2025  
**Related**: [Main Design Proposal](README.md)  
**Status**: Future Enhancement - Not required for core integration

## Overview

This document describes the billing feedback loop enhancement that enables accurate cost tracking when vSR routes requests to different models. This is a future capability that can be added to improve billing accuracy but is not mandatory for the initial vSR-MaaS integration.

## The Problem: Billing Accuracy with Dynamic Routing

**Without Dynamic Metadata, Billing is Inaccurate:**
- User calls: `POST /chat/completions`
- vSR routes to: `llama3-70b` (expensive) or `tiny-llama` (cheap)  
- Billing sees: `/chat/completions` path only
- Result: Incorrect cost calculation

## The Solution: Dynamic Billing Metadata

```http
# Before vSR Processing
POST /chat/completions
Authorization: Bearer token123

# After vSR Processing  
POST /chat/completions
Authorization: Bearer token123
Host: llama3-70b-service
X-MaaS-Model-Selected: llama3-70b    # ← CRITICAL FOR BILLING
X-Model-Cost: 0.75                   # ← COST OVERRIDE
```

## Implementation Details

### Enhanced Billing System (Asynchronous Processing)

```go
type UsageEvent struct {
    UserID           string    `json:"user_id"`
    APIPath          string    `json:"api_path"`           // "/chat/completions"
    SelectedModel    string    `json:"selected_model"`     // "llama3-70b" 
    ActualCost       float64   `json:"actual_cost"`        // 0.75
    BillingOverride  bool      `json:"billing_override"`   // true
    Timestamp        time.Time `json:"timestamp"`
}

// Asynchronous billing collection - does not block request flow
func (bc *BillingCollector) ProcessUsageEventAsync(headers map[string]string) *UsageEvent {
    event := &UsageEvent{
        APIPath: headers["X-Original-Path"],
        UserID:  headers["X-User-ID"],
    }
    
    // CRITICAL: Check for dynamic model selection
    if selectedModel := headers["X-MaaS-Model-Selected"]; selectedModel != "" {
        event.SelectedModel = selectedModel
        event.ActualCost = parseFloat(headers["X-Model-Cost"])
        event.BillingOverride = true
        
        // Process billing asynchronously - enqueue event
        go bc.EnqueueBillingEvent(event)  // Non-blocking async processing
        return event
    }
    
    // Fallback to path-based billing
    event.ActualCost = bc.getPathBasedCost(event.APIPath)
    go bc.EnqueueBillingEvent(event)  // Also async for consistency
    return event
}

// Asynchronous billing queue processor
func (bc *BillingCollector) EnqueueBillingEvent(event *UsageEvent) {
    // Add to queue/topic for async processing (e.g., Kafka, Redis Queue)
    bc.billingQueue.Enqueue(event)
    // Does not block request processing
}
```

## Implementation Requirements

### MaaS Components Required:
1. **Billing Collector Enhancement**: Must read `X-MaaS-Model-Selected` header
2. **Usage Tracking Enhancement**: Cost calculation based on actual selected model (not API path)
3. **Queue Processing**: Asynchronous event processing for billing data

### vSR Components Required:
1. **Header Injection**: Must inject `X-MaaS-Model-Selected` header
2. **Cost Calculation**: Must inject `X-Model-Cost` header with accurate pricing

## Benefits

- **Accurate Billing**: Users pay for actual model used, not API endpoint
- **Cost Transparency**: Clear tracking of which models are being used
- **Performance**: Async processing doesn't impact request latency
- **Flexibility**: Works with any routing decisions vSR makes

## Migration Strategy

1. **Phase 1**: Deploy core integration without billing feedback
2. **Phase 2**: Implement billing enhancements when needed
3. **Phase 3**: Enable dynamic billing for improved accuracy

This enhancement can be added later without disrupting the core vSR-MaaS integration.