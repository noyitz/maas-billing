# Adaptive Throttling & Model Fallbacks

**Document**: Advanced Use Case Overview  
**Date**: December 2025  
**Related**: [Main Design Proposal](design-proposal-vsr-maas-integration.md)

## Overview

Adaptive throttling with intelligent model fallbacks represents one of the most sophisticated capabilities of the integrated vSR-MaaS platform. This feature enables cost-aware model selection with automatic downgrading when premium models reach capacity limits, ensuring service availability while optimizing costs.

## Use Case Scenario

**Enterprise Customer Journey**: A premium tier user submits a complex mathematical query that would optimally be routed to GPT-4, but the model has reached its rate limit. The system intelligently downgrades to a more affordable but still capable model (phi4-mini) while maintaining service availability.

## Scenario Description

### 1. Fallback Decision Flow

```mermaid
graph TD
    Request[Incoming Request<br/>Complex Math Query] --> Auth[Authentication & Tier Check<br/>Premium User]
    Auth --> CategoryClassification[Category Classification<br/>Result: Mathematics]
    
    CategoryClassification --> PrimaryModel{Check Primary Model<br/>GPT-4 for Math}
    PrimaryModel -->|Available| BudgetCheck[Budget Check<br/>Premium: $50 remaining<br/>GPT-4 cost: $15]
    PrimaryModel -->|Rate Limited| CheckFallback1[Check Fallback 1<br/>phi4-mini]
    
    BudgetCheck -->|Within Budget| ReserveBudget[Reserve $15<br/>Execute on GPT-4]
    BudgetCheck -->|Exceeds Budget| CheckFallback1
    
    CheckFallback1 -->|Available| BudgetCheck2[Budget Check<br/>phi4-mini cost: $2]
    CheckFallback1 -->|Rate Limited| CheckFallback2[Check Fallback 2<br/>llama3-8b]
    
    BudgetCheck2 -->|Within Budget| ReserveBudget2[Reserve $2<br/>Execute on phi4-mini]
    BudgetCheck2 -->|Exceeds Budget| CheckFallback2
    
    CheckFallback2 -->|Available| BudgetCheck3[Budget Check<br/>llama3-8b cost: $1]
    CheckFallback2 -->|Rate Limited| CacheCheck[Check Semantic Cache<br/>Similar Math Queries]
    
    BudgetCheck3 -->|Within Budget| ReserveBudget3[Reserve $1<br/>Execute on llama3-8b]
    BudgetCheck3 -->|Exceeds Budget| CacheCheck
    
    CacheCheck -->|Cache Hit| ReturnCached[Return Cached Response<br/>Cost: $0]
    CacheCheck -->|Cache Miss| ErrorResponse[Return 503:<br/>Service Temporarily Unavailable<br/>Retry-After: 60s]
    
    ReserveBudget --> Success[Premium Response<br/>High Accuracy]
    ReserveBudget2 --> Success2[Good Response<br/>Acceptable Accuracy]
    ReserveBudget3 --> Success3[Basic Response<br/>Limited Accuracy]
    ReturnCached --> Success4[Cached Response<br/>No Additional Cost]
    
    style Request fill:#e1f5fe
    style Auth fill:#f3e5f5
    style CategoryClassification fill:#e8f5e8
    style PrimaryModel fill:#fff3e0
    style ReserveBudget fill:#e8f5e8
    style ErrorResponse fill:#ffebee
```

### 2. Request Flow with Fallback

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as maas-default-gateway
    participant Authorino
    participant vSR as vSR ExtProc
    participant BudgetTracker
    participant ModelChecker as Availability Checker
    participant Limitador
    participant GPT4 as GPT-4 (Primary)
    participant Phi4 as phi4-mini (Fallback 1)
    participant Llama as llama3-8b (Fallback 2)
    participant Cache as Semantic Cache
    
    Note over Client,Cache: Enterprise user submits complex math query
    Client->>Gateway: POST /v1/chat/completions<br/>Complex calculus problem
    Gateway->>Authorino: Validate enterprise token
    Authorino-->>Gateway: Auth success (Enterprise tier, $50 budget)
    
    Gateway->>vSR: Forward with auth context<br/>X-Tier: enterprise, X-Budget: 50
    vSR->>vSR: Classify category = "mathematics"
    vSR->>vSR: Primary selection = GPT-4 ($15 cost)
    
    Note over vSR,GPT4: Attempt primary model
    vSR->>BudgetTracker: Can afford $15?
    BudgetTracker-->>vSR: Yes, budget available
    vSR->>ModelChecker: Is GPT-4 available?
    ModelChecker-->>vSR: No, rate limited (retry in 5min)
    
    Note over vSR,Phi4: Try fallback model 1
    vSR->>vSR: Fallback 1 = phi4-mini ($2 cost)
    vSR->>BudgetTracker: Can afford $2?
    BudgetTracker-->>vSR: Yes, budget available
    vSR->>ModelChecker: Is phi4-mini available?
    ModelChecker-->>vSR: Yes, available
    vSR->>BudgetTracker: Reserve $2
    BudgetTracker-->>vSR: Reserved successfully
    
    Note over vSR,Limitador: Execute with fallback model
    vSR-->>Gateway: Route to phi4-mini<br/>X-Selected-Model: phi4-mini<br/>X-Fallback-Used: true<br/>X-Fallback-Reason: primary_rate_limited
    Gateway->>Limitador: Apply rate limits for phi4-mini
    Limitador-->>Gateway: Rate limit OK
    Gateway->>Phi4: Execute math query
    Phi4-->>Gateway: Mathematical solution
    Gateway->>Cache: Store result (category: math)
    Gateway-->>Client: Response with fallback headers<br/>X-Used-Model: phi4-mini<br/>X-Cost-Saved: 13<br/>X-Performance-Ratio: 0.85
```

## Expected Benefits

### 1. Cost Optimization
- **40-70% cost reduction** through intelligent model downgrading
- **Budget efficiency** with burst allowances for peak usage
- **Transparent cost tracking** with detailed per-request cost attribution

### 2. Service Availability
- **99.9% uptime** even when premium models are rate-limited
- **Graceful degradation** maintaining service quality within budget constraints
- **Intelligent caching** reducing repeated costs for similar queries

### 3. User Experience
- **Transparent fallbacks** with clear explanation headers
- **Performance awareness** with ratio indicators
- **Cost visibility** showing savings achieved through fallbacks

## Implementation Status

**Status**: To Be Determined (TBD)

The detailed implementation of this advanced use case, including:
- Component architecture and Go code implementations
- Configuration examples and YAML policies
- Monitoring metrics and alerting rules
- Testing strategies and validation procedures

Will be designed and implemented in subsequent phases of the vSR-MaaS integration project.