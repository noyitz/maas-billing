# Design Proposal: vLLM Semantic Router (vSR) Integration with Models-as-a-Service (MaaS)

**Document Status**: Draft  
**Date**: December 2025  
**Author**: Noy Itzikowitz  
**Target Branch**: [maas-billing/main](https://github.com/noyitz/maas-billing/tree/main)

## Executive Summary

This design proposal outlines the integration strategy for vLLM Semantic Router (vSR) with the Models-as-a-Service (MaaS) platform. The integration aims to enhance the MaaS platform with intelligent semantic routing capabilities while maintaining robust rate limiting, billing, and security features.

The proposal evaluates two primary integration patterns and recommends a hybrid approach that maximizes the benefits of both systems while addressing critical challenges in model selection, rate limiting, and adaptive throttling.

## 1. Architecture Overview

### Current MaaS Architecture

The MaaS platform provides a complete Models-as-a-Service solution with policy-based access control:

```mermaid
graph TB
    subgraph "Client Layer"
        Client[Client Applications<br/>with Service Account Token]
    end
    
    subgraph "Gateway Layer"
        GatewayAPI[maas-default-gateway<br/>All Traffic Entry Point]
        Envoy[Envoy Proxy]
    end
    
    subgraph "RHCL Policy Engine"
        Kuadrant[Kuadrant<br/>Policy Attachment]
        Authorino[Authorino<br/>Authentication Service]
        Limitador[Limitador<br/>Rate Limiting Service]
    end
    
    subgraph "Policy Components"
        AuthPolicy[AuthPolicy<br/>gateway-auth-policy]
        RateLimitPolicy[RateLimitPolicy<br/>gateway-rate-limits]
        TokenRateLimitPolicy[TokenRateLimitPolicy<br/>gateway-token-rate-limits]
    end
    
    subgraph "Model Access Control"
        RBAC[Kubernetes RBAC<br/>Service Account Permissions]
        LLMInferenceService[LLMInferenceService<br/>Model Access Control]
    end
    
    subgraph "Model Serving"
        RHOAI[RHOAI Platform]
        Models[LLM Models<br/>Qwen, Granite, Llama]
    end
    
    Client --> GatewayAPI
    GatewayAPI --> Envoy
    
    Envoy --> Kuadrant
    Kuadrant --> Authorino
    Kuadrant --> Limitador
    
    Authorino --> AuthPolicy
    Limitador --> RateLimitPolicy
    Limitador --> TokenRateLimitPolicy
    
    Envoy --> RBAC
    RBAC --> LLMInferenceService
    LLMInferenceService --> RHOAI
    RHOAI --> Models
```

**Key Components:**
- **maas-default-gateway**: Single entry point for all traffic (token requests and inference)
- **RHCL (Red Hat Connectivity Link)**: Policy engine handling authentication and authorization
- **Authorino**: Token validation (OpenShift tokens for MaaS API, Service Account tokens for inference)
- **Limitador**: Rate limiting and quota enforcement
- **RHOAI Model Serving**: Backend LLM model execution platform

#### Model Inference Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant GatewayAPI
    participant Kuadrant
    participant Authorino
    participant Limitador
    participant AuthPolicy
    participant RateLimitPolicy
    participant LLMInferenceService
    
    Client->>GatewayAPI: Inference Request + Service Account Token
    GatewayAPI->>Kuadrant: Applying Policies
    Kuadrant->>Authorino: Validate Service Account Token
    Authorino->>AuthPolicy: Check Token Validity
    AuthPolicy-->>Authorino: Token Valid + Tier Info
    Authorino-->>Kuadrant: Authentication Success
    Kuadrant->>Limitador: Check Rate Limits
    Limitador->>RateLimitPolicy: Apply Tier-based Limits
    RateLimitPolicy-->>Limitador: Rate Limit Status
    Limitador-->>Kuadrant: Rate Check Result
    Kuadrant-->>GatewayAPI: Policy Decision (Allow/Deny)
    GatewayAPI ->> LLMInferenceService: Forward Request
    LLMInferenceService-->>Client: Response
```

### Current vSR Architecture

The vSR system implements a sophisticated Mixture-of-Models architecture using Envoy Proxy with External Processor integration:

```mermaid
graph TB
    subgraph "Client Layer"
        Client1[Web Application]
        Client2[Mobile App]
        Client3[API Client]
        Client4[Third-party Integration]
    end
    
    subgraph "Proxy Layer"
        Envoy[Envoy Proxy<br/>:8801]
    end
    
    subgraph "Processing Layer"
        ExtProc[Semantic Router<br/>ExtProc Server<br/>:50051]
        
        subgraph "Router Components"
            Classifier[BERT Classifier<br/>ModernBERT]
            PIIDetector[PII Detector<br/>Privacy Protection]
            JailbreakGuard[Jailbreak Guard<br/>Security]
            Cache[Semantic Cache<br/>Performance]
            ToolsSelector[Tools Selector<br/>Optimization]
        end
    end
    
    subgraph "Model Layer"
        Model1[Math Specialist<br/>Endpoint 1]
        Model2[Creative Model<br/>Endpoint 2] 
        Model3[Code Generator<br/>Endpoint 3]
        ModelN[General Purpose<br/>Endpoint N]
    end
    
    Client1 --> Envoy
    Client2 --> Envoy
    Client3 --> Envoy
    Client4 --> Envoy
    
    Envoy <--> ExtProc
    
    ExtProc --> Classifier
    ExtProc --> PIIDetector
    ExtProc --> JailbreakGuard
    ExtProc --> Cache
    ExtProc --> ToolsSelector
    
    Envoy --> Model1
    Envoy --> Model2
    Envoy --> Model3
    Envoy --> ModelN
```

**Key Components:**
- **Envoy Proxy**: Traffic management layer with load balancing, health checking, and request/response processing
- **vSR ExtProc Service**: Go-based gRPC service providing semantic classification and routing intelligence
- **ModernBERT Classifiers**: Multi-task classification for category detection, PII scanning, and jailbreak prevention
- **Semantic Cache**: Performance optimization with similarity-based caching
- **Tool Selection**: Automatic optimization to reduce token usage and improve accuracy

#### Request Processing Pipeline

```mermaid
sequenceDiagram
    participant Client
    participant Envoy
    participant ExtProc as vSR ExtProc
    participant Cache as Semantic Cache
    participant PII as PII Detector
    participant Guard as Jailbreak Guard
    participant Classifier as Category Classifier
    participant Model as Selected Model
    
    Client->>Envoy: HTTP Request
    Envoy->>ExtProc: ExtProc Request (Headers + Body)
    
    ExtProc->>Cache: Check semantic cache
    
    alt Cache Hit
        Cache->>ExtProc: Cached response
        ExtProc->>Envoy: Return cached result
    else Cache Miss
        ExtProc->>PII: Scan for PII
        PII->>ExtProc: PII status
        ExtProc->>Guard: Check for jailbreak
        Guard->>ExtProc: Safety status
        ExtProc->>Classifier: Classify intent
        Classifier->>ExtProc: Category + confidence
        ExtProc->>ExtProc: Select optimal model
        ExtProc->>Envoy: Set routing headers<br/>x-selected-model
        Envoy->>Model: Route to selected model
        Model->>Envoy: Model response
        Envoy->>ExtProc: Response processing
        ExtProc->>Cache: Store semantic representation
        ExtProc->>Envoy: Final response
    end
    
    Envoy->>Client: HTTP Response
```


## 2. Authorization (AuthZ) Analysis

### 2.1 MaaS Authorization Architecture

MaaS implements a comprehensive authorization system using Authorino with multi-layered access control:

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as maas-default-gateway
    participant Authorino
    participant MaaSAPI as MaaS API
    participant K8sAPI as Kubernetes API
    participant Model as LLM Model
    
    Client->>Gateway: Request + Service Account Token
    Gateway->>Authorino: Apply AuthPolicy
    
    Note over Authorino: Phase 1 - Authentication
    Authorino->>K8sAPI: TokenReview (validate SA token)
    K8sAPI-->>Authorino: User identity + groups
    
    Note over Authorino: Phase 2 - Tier Resolution  
    Authorino->>MaaSAPI: POST /v1/tiers/lookup<br/>{"groups": [...]}
    MaaSAPI-->>Authorino: {"tier": "premium"}
    
    Note over Authorino: Phase 3 - RBAC Authorization
    Authorino->>K8sAPI: SubjectAccessReview<br/>Can user POST to specific model?
    K8sAPI-->>Authorino: Allow/Deny
    
    Authorino-->>Gateway: Auth Success<br/>Headers: userid, tier
    Gateway->>Model: Forward request with auth context
```

**Key Authorization Components:**
- **Authentication**: Kubernetes TokenReview validates Service Account tokens
- **Tier Resolution**: MaaS API maps user groups to subscription tiers (free/premium/enterprise)
- **RBAC Authorization**: Kubernetes SubjectAccessReview checks model-specific permissions
- **Context Injection**: Auth metadata (userid, tier) added to request headers

### 2.2 vSR Authorization Architecture 

vSR currently operates as a pure routing layer without built-in authorization:

```mermaid
sequenceDiagram
    participant Client
    participant Envoy as Envoy Proxy
    participant ExtProc as vSR ExtProc
    participant Model as Selected Model
    
    Client->>Envoy: Raw request (no auth validation)
    Envoy->>ExtProc: Forward for semantic processing
    
    Note over ExtProc: Semantic Classification
    ExtProc->>ExtProc: Category classification
    ExtProc->>ExtProc: PII detection (content-based)
    ExtProc->>ExtProc: Model selection
    
    ExtProc-->>Envoy: Routing headers<br/>x-selected-model: llama3-8b
    Envoy->>Model: Route to selected model
```

**Key Characteristics:**
- **No Built-in AuthZ**: vSR assumes requests are pre-authorized
- **Content-based Security**: PII detection and jailbreak prevention based on request content
- **Model Selection**: Intelligent routing based on semantic analysis
- **Stateless Design**: No user context or session management

## 3. Comparative Analysis: Order of Operations

### Option A: MaaS before vSR (MaaS → vSR)

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Limitador
    participant MaaS
    participant VSR
    participant Model
    
    Client->>Gateway: Request + Token
    Gateway->>Limitador: Apply tier-based limits
    Limitador->>MaaS: Rate limit passed
    MaaS->>MaaS: Validate token & tier
    MaaS->>VSR: Forward with tier context
    VSR->>VSR: Semantic classification
    VSR->>Model: Route to optimal model
    Model->>Client: Response
```

#### Gains vs. Losses Analysis

| **Gains** | **Losses** |
|-----------|------------|
| **✅ Early Authentication**: Token validation and tier resolution happens immediately | **❌ No Per-Model Rate Limiting**: Cannot apply model-specific limits since model selection hasn't occurred |
| **✅ Security First**: Authentication and authorization happen before semantic processing | **❌ Wasted Processing**: Rate limiting occurs before knowing if expensive models will be used |
| **✅ Proven Architecture**: Leverages existing MaaS patterns and policies | **❌ Suboptimal Resource Allocation**: Cannot differentiate between high/low cost model requests for rate limiting |
| **✅ Consistent User Experience**: All users follow the same authentication flow | **❌ Limited Fallback Options**: No opportunity for model downgrading when premium models hit limits |
| **✅ Operational Simplicity**: No changes needed to existing MaaS rate limiting policies | **❌ Missed Optimization**: Cannot leverage semantic caching early to avoid downstream processing |

### Option B: vSR before MaaS (vSR → MaaS)

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant VSR
    participant Limitador
    participant MaaS
    participant Model
    
    Client->>Gateway: Request + Token
    Gateway->>VSR: Forward for classification
    VSR->>VSR: Semantic classification + model selection
    VSR->>Limitador: Apply model-specific limits
    Limitador->>MaaS: Rate limit passed with model context
    MaaS->>MaaS: Validate access to selected model
    MaaS->>Model: Route to classified model
    Model->>Client: Response
```

#### Gains vs. Losses Analysis

| **Gains** | **Losses** |
|-----------|------------|
| **✅ Per-Model Rate Limiting**: Can apply specific limits based on model cost and complexity | **❌ Security Risk**: Semantic processing occurs before full authentication |
| **✅ Intelligent Resource Management**: Rate limits can consider model computational costs | **❌ Authentication Bypass Risk**: Risk of processing requests with invalid tokens through semantic router |
| **✅ Advanced Fallback**: Can downgrade to cheaper models when expensive ones hit limits | **❌ Complex Error Handling**: Authentication failures after semantic processing waste resources |
| **✅ Semantic Caching Benefits**: Early caching can prevent downstream processing entirely | **❌ Tier Resolution Complexity**: vSR needs access to user tier information for proper model selection |
| **✅ Optimal Tool Selection**: Tools can be selected before rate limiting, improving accuracy | **❌ Architectural Disruption**: Requires significant changes to existing MaaS auth flow |

## 4. Proposed Solution

Based on the analysis of both options, we recommend the **Authorization-First Integrated Architecture** that combines the security benefits of Option A with the intelligent routing capabilities of Option B.

### 4.1 Recommended Flow: Auth → vSR → MaaS Rate Limiting

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as maas-default-gateway  
    participant Authorino
    participant MaaSAPI as MaaS API
    participant vSR as vSR ExtProc
    participant Limitador
    participant Model
    
    Note over Client,Model: Phase 1: Authentication & Authorization
    Client->>Gateway: Request + Service Account Token
    Gateway->>Authorino: Apply AuthPolicy
    Authorino->>MaaSAPI: Tier lookup + RBAC check
    MaaSAPI-->>Authorino: User authorized for semantic routing
    Authorino-->>Gateway: Auth Success + tier context
    
    Note over Client,Model: Phase 2: Semantic Routing
    Gateway->>vSR: Forward with auth headers<br/>X-User-ID, X-Tier, X-Groups
    vSR->>vSR: Semantic classification
    vSR->>vSR: Model selection based on category + tier
    vSR-->>Gateway: Routing decision<br/>X-Selected-Model, X-Model-Cost
    
    Note over Client,Model: Phase 3: Model-Aware Rate Limiting
    Gateway->>Limitador: Apply rate limits with model context
    Limitador->>Limitador: Check tier + model-specific limits
    Limitador-->>Gateway: Rate limit decision
    Gateway->>Model: Execute on selected model
```

### 4.2 Integrated Architecture

Based on the analysis of both options, we propose the **Authorization-First Integrated Architecture** that combines the security benefits of Option A with the intelligent routing capabilities of Option B:

```mermaid
graph TB
    subgraph "Client Layer"
        Client[Clients/Applications]
    end
    
    subgraph "Entry Layer"
        LB[L4 Load Balancer]
        Proxy[L7 Web App Proxy]
    end
    
    subgraph "Security & Rate Limiting Layer"
        Auth["L7 Authorino<br/>Authentication"]
        RateLimit["L7 Limitador<br/>Rate Limiting"]
    end
    
    subgraph "Semantic Routing Layer"
        VSR["L7 vSR ExtProc<br/>Model Picker"]
        Classifier[ModernBERT Classifier]
        PIIGuard[PII Detection]
        Cache[Semantic Cache]
    end
    
    subgraph "Model Access Layer"
        MaaS["L7 MaaS llm-d<br/>Model Gateway"]
        RBAC[Model Access Control]
    end
    
    subgraph "Model Serving Layer"
        Model1["Math Specialist<br/>phi4-mini"]
        Model2["General Purpose<br/>llama3-8b"]
        Model3["Code Generator<br/>CodeLlama"]
        ModelN["Enterprise Models<br/>GPT-4 class"]
    end
    
    Client --> LB
    LB --> Proxy
    Proxy --> Auth
    Auth --> RateLimit
    RateLimit --> VSR
    VSR --> Classifier
    VSR --> PIIGuard  
    VSR --> Cache
    VSR --> MaaS
    MaaS --> RBAC
    RBAC --> Model1
    RBAC --> Model2
    RBAC --> Model3
    RBAC --> ModelN
```

**Key Design Principles:**
- **Security First**: Full authentication and authorization before semantic processing
- **Intelligent Routing**: vSR operates with full user context and permissions
- **Model-Aware Rate Limiting**: Rate limits applied after model selection with cost awareness
- **Clear Separation**: Each component focuses on its core responsibility

### 2.5 Enhanced Authorization Policy Configuration

To support the Authorization-First flow, we need an enhanced AuthPolicy that grants semantic routing access:

```yaml
# Enhanced AuthPolicy for vSR integration
apiVersion: kuadrant.io/v1
kind: AuthPolicy
metadata:
  name: enhanced-gateway-auth-policy
  namespace: openshift-ingress
spec:
  targetRef:
    group: gateway.networking.k8s.io
    kind: Gateway
    name: maas-default-gateway
  rules:
    metadata:
      # Tier resolution (existing)
      matchedTier:
        http:
          url: http://maas-api.maas-api.svc.cluster.local:8080/v1/tiers/lookup
          contentType: application/json
          method: POST
          body:
            expression: '{ "groups": auth.identity.user.groups }'
        cache:
          key:
            selector: auth.identity.user.username
          ttl: 300
      
      # New: Model capabilities lookup
      allowedModels:
        http:
          url: http://maas-api.maas-api.svc.cluster.local:8080/v1/models/allowed
          contentType: application/json  
          method: POST
          body:
            expression: '{ "tier": auth.metadata.matchedTier["tier"], "groups": auth.identity.user.groups }'
        cache:
          key:
            selector: "{auth.identity.user.username}:{auth.metadata.matchedTier.tier}"
          ttl: 600
            
    authentication:
      service-accounts:
        kubernetesTokenReview:
          audiences:
            - maas-default-gateway-sa
        defaults:
          userid:
            expression: 'auth.identity.user.username.split(":")[3]'
        cache:
          key:
            selector: context.request.http.headers.authorization.@case:lower
          ttl: 600
          
    authorization:
      # Basic tier access (existing)
      tier-access:
        cache:
          key:
            selector: "{auth.identity.user.username}:{request.path}"
          ttl: 60
        kubernetesSubjectAccessReview:
          user:
            expression: auth.identity.user.username
          authorizationGroups:
            expression: auth.identity.user.groups
          resourceAttributes:
            group:
              value: serving.kserve.io
            resource:
              value: llminferenceservices
            verb:
              value: post
      
      # New: Semantic routing access control
      semantic-routing-access:
        cache:
          key:
            selector: "{auth.identity.user.username}:semantic-routing"
          ttl: 300
        kubernetesSubjectAccessReview:
          user:
            expression: auth.identity.user.username
          authorizationGroups:
            expression: auth.identity.user.groups
          resourceAttributes:
            group:
              value: semantic-router.vllm.ai
            resource:
              value: semanticRouting
            namespace:
              value: default
            verb:
              value: use
              
    response:
      success:
        filters:
          identity:
            json:
              properties:
                userid:
                  expression: auth.identity.userid
                tier:
                  expression: auth.metadata.matchedTier["tier"]
                allowedModels:
                  expression: auth.metadata.allowedModels["models"]
                maxCostPerRequest:
                  expression: auth.metadata.matchedTier["maxCostPerRequest"]
```

### 2.6 vSR ExtProc Enhancement for Authorization Context

vSR needs to be enhanced to understand and respect authorization context:

```go
// Enhanced vSR ExtProc with authorization awareness
type AuthorizedOpenAIRouter struct {
    *openai.OpenAIRouter
    
    // Authorization context processors
    tierProcessor     TierProcessor
    modelValidator    ModelValidator
    budgetTracker     BudgetTracker
}

func (r *AuthorizedOpenAIRouter) ProcessRequestHeaders(headers map[string]string) (*RoutingDecision, error) {
    // Extract authorization context
    authContext := &AuthContext{
        UserID:       headers["X-User-ID"],
        Tier:         headers["X-Tier"], 
        AllowedModels: parseModels(headers["X-Allowed-Models"]),
        MaxCost:      parseFloat(headers["X-Max-Cost-Per-Request"]),
    }
    
    // Validate user has semantic routing access
    if !r.hasSemanticRoutingPermission(authContext) {
        return nil, errors.New("user not authorized for semantic routing")
    }
    
    // Perform semantic classification with tier context
    category, confidence, err := r.Classifier.ClassifyWithTier(body, authContext.Tier)
    if err != nil {
        return nil, err
    }
    
    // Select model based on category + tier constraints
    selectedModel, cost, err := r.selectModelForTier(category, authContext)
    if err != nil {
        return nil, err
    }
    
    return &RoutingDecision{
        Category:      category,
        SelectedModel: selectedModel,
        EstimatedCost: cost,
        UserContext:   authContext,
    }, nil
}

func (r *AuthorizedOpenAIRouter) selectModelForTier(category string, auth *AuthContext) (string, float64, error) {
    // Get models for category
    candidates := r.getModelsForCategory(category)
    
    // Filter by user's allowed models
    allowedCandidates := r.filterByAllowedModels(candidates, auth.AllowedModels)
    if len(allowedCandidates) == 0 {
        return "", 0, errors.New("no allowed models for category")
    }
    
    // Select best model within cost budget
    for _, model := range allowedCandidates {
        if model.CostPerRequest <= auth.MaxCost {
            return model.Name, model.CostPerRequest, nil
        }
    }
    
    // Fallback to cheapest allowed model
    return allowedCandidates[len(allowedCandidates)-1].Name, allowedCandidates[len(allowedCandidates)-1].CostPerRequest, nil
}
```

## 5. Advanced Use Cases and Implementation Details

The core design proposal above provides the foundation for the integrated vSR-MaaS platform. The following sections detail advanced use cases, deployment options, and operational considerations.

### 5.1 Adaptive Throttling & Model Fallbacks

For detailed implementation of intelligent model fallbacks with cost-aware throttling, see:
**[📋 Adaptive Throttling & Model Fallbacks](adaptive-throttling-and-model-fallbacks.md)**

This document covers:
- Enterprise-grade fallback decision trees with budget constraints
- Component implementation details for budget tracking and circuit breakers
- Complete sequence diagrams for fallback scenarios
- Configuration examples for model hierarchy and rate limiting policies
- Monitoring and alerting strategies for adaptive systems

### 5.2 Gateway Consolidation Options

For comprehensive analysis of deployment architecture patterns, see:
**[📋 Gateway Consolidation Options](gateway-consolidation-options.md)**

This document analyzes:
- Dual Gateway vs Unified Gateway architectures
- Hybrid Container and Service Mesh deployment patterns  
- Performance, cost, and operational trade-offs
- Implementation examples for each architecture
- Recommendation matrix and migration strategies

### 5.3 Monitoring and Observability

For complete observability strategy and implementation, see:
**[📋 Monitoring and Observability](monitoring-and-observability.md)**

This document details:
- Current monitoring capabilities in MaaS and vSR systems
- Enhanced metrics framework for the integrated platform
- End-to-end tracing and distributed monitoring
- Business intelligence dashboards and alerting strategies
- SLIs/SLOs and error budget management

## 6. Security Considerations

### 6.1 PII Protection in Integrated Flow

The integrated architecture maintains robust PII protection through multiple layers:

```mermaid
graph TB
    Request[Incoming Request] --> Auth[Authentication]
    Auth --> PIICheck{PII Detection<br/>by vSR}
    PIICheck -->|PII Found| Redaction[PII Redaction]
    PIICheck -->|Clean| Classification[Semantic Classification]
    Redaction --> Classification
    Classification --> ModelSelection[Model Selection]
    ModelSelection --> RateLimit[Rate Limiting]
    RateLimit --> Execution[Model Execution]
```

### 6.2 Security Controls

1. **Early PII Detection**: vSR performs PII detection before MaaS processing
2. **Token Scope Validation**: Ensure tokens have appropriate permissions for selected models
3. **Audit Logging**: Comprehensive logging of all routing and fallback decisions
4. **Data Isolation**: Semantic cache respects tenant isolation boundaries

### 6.3 Authorization Flow Security

The proposed Authorization-First flow ensures:
- **Authentication before Processing**: No semantic analysis occurs without valid authentication
- **Tier-Based Access Control**: Model selection respects user tier and permissions
- **Model-Specific RBAC**: Fine-grained access control for individual models
- **Budget Enforcement**: Prevents unauthorized access to expensive models

---

**Document Version**: 2.0  
**Last Updated**: December 2025  
**Review Status**: Ready for Architecture Review Board  
**Next Review Date**: January 2026
