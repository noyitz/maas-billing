# Design Proposal: vLLM Semantic Router (vSR) Integration with Models-as-a-Service (MaaS)

**Document Status**: Design Proposal  
**Date**: January 2026  
**Author**: Noy Itzikowitz  
**Target Branch**: [maas-billing/main](https://github.com/noyitz/maas-billing/tree/main)

## Executive Summary

This design proposal presents the integration architecture for vLLM Semantic Router (vSR) with the Models-as-a-Service (MaaS) platform. The integration enhances the MaaS platform with intelligent semantic routing capabilities while maintaining enterprise-grade security, rate limiting, and billing features.

The proposal recommends an **Enhanced Hybrid Authorization-First Architecture** that combines MaaS's proven security and policy enforcement with vSR's intelligent routing capabilities. This architecture eliminates authorization bottlenecks through pre-authorization with model constraints, enabling seamless user experiences while maintaining strict access controls.

**Key Benefits:**
- **Intelligent Routing**: Semantic classification directs requests to optimal models based on content analysis
- **Elimination of Authorization Failures**: Pre-authorization ensures vSR selects only from user-accessible models  
- **Enterprise Security**: PII detection, jailbreak prevention, and comprehensive audit trails
- **Modular Composition**: Plugin-based architecture supports future ecosystem integration
- **Operational Excellence**: Leverages existing production-ready infrastructure from both platforms

## 1. Architecture Overview

### 1.1 Design Principles

The integration architecture is designed around the following core principles:

- **Security First**: Authentication and authorization occur before semantic processing
- **Performance Optimization**: Single request parsing through composable pipeline architecture  
- **Modular Composition**: Plugin-based design supports selective feature activation and ecosystem integration
- **Enterprise Grade**: Leverages proven production infrastructure from both platforms
- **Operational Simplicity**: Unified management through existing CLI and deployment tools

### 1.2 Current Platform Architectures

#### MaaS Platform Architecture

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
- **MaaS API**: Go-based API with token management (ephemeral + named API keys) and tier resolution
- **Gateway API**: Single entry point for all traffic with policy enforcement
- **Kuadrant/Authorino**: Authentication, authorization, and policy enforcement with 300s caching
- **Limitador**: Rate limiting service with tier-based policies (free/premium/enterprise)
- **RHOAI Model Serving**: Backend LLM model execution platform

#### vSR Platform Architecture

The vSR system implements intelligent Mixture-of-Models architecture using Envoy Proxy with External Processor integration:

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
- **vSR CLI**: Comprehensive deployment and management CLI with multi-environment support
- **Envoy ExtProc**: Production-ready gRPC service (port 50051) for semantic routing
- **ModernBERT Classifiers**: Multi-task classification for category detection, PII scanning, and jailbreak prevention
- **Semantic Cache**: Performance optimization with similarity-based caching
- **Tool Selection**: Automatic optimization to reduce token usage and improve accuracy

### 1.3 Modular Composition Strategy

The integration employs a **composable pipeline approach** that enables selective component activation while avoiding multiple request parsing passes through Envoy proxy.

#### Option 1: Plugin-Based Composition (Recommended)

```mermaid
graph TB
    subgraph "Single ExtProc Service"
        ExtProcCore[vSR ExtProc Core]
        PluginManager[Plugin Manager]
        
        subgraph "Selectable Plugins"
            PIIPlugin[PII Detection Plugin]
            JailbreakPlugin[Jailbreak Detection Plugin] 
            SemanticPlugin[Semantic Classification Plugin]
            ToolPlugin[Tool Selection Plugin]
            ReasoningPlugin[Reasoning Mode Plugin]
        end
    end
    
    subgraph "External Integrations"
        LLMDIntegration[llm-d Integration]
        LlamaStackIntegration[Llama Stack Integration] 
        MCPIntegration[MCP Gateway Integration]
    end
    
    ExtProcCore --> PluginManager
    PluginManager --> PIIPlugin
    PluginManager --> JailbreakPlugin
    PluginManager --> SemanticPlugin
    PluginManager --> ToolPlugin
    PluginManager --> ReasoningPlugin
    
    PluginManager --> LLMDIntegration
    PluginManager --> LlamaStackIntegration
    PluginManager --> MCPIntegration
```

**Configuration Example:**
```yaml
vsr_composition:
  # Security-first components (always enabled for enterprise)
  security_pipeline:
    pii_detection: true
    jailbreak_prevention: true
    content_filtering: true
  
  # Routing intelligence (configurable based on use case)
  routing_pipeline:
    semantic_classification: true
    model_selection: true
    tool_selection: false  # Disabled if MCP Gateway handles this
    
  # Orchestration components (selective based on ecosystem)
  orchestration_pipeline:
    reasoning_mode: true
    context_management: false  # Disabled if llm-d handles this
    
  # External component integration
  external_integrations:
    llm_d_enabled: true
    llama_stack_enabled: false
    mcp_gateway_enabled: true
```

**Benefits:**
- ✅ **Single Request Parse**: One ExtProc service, multiple internal plugins
- ✅ **Selective Activation**: Enable only needed components per deployment
- ✅ **Security First**: PII/Jailbreak detection remains in security-critical path
- ✅ **Ecosystem Integration**: Clean interfaces for llm-d, Llama Stack, MCP Gateway
- ✅ **Performance Optimization**: Avoid unnecessary processing overhead

## 2. Enhanced Hybrid Architecture

### 2.1 Integration Flow Overview

The integration implements a **multi-phase enhanced flow** that maximizes security, eliminates authorization bottlenecks, and enables intelligent routing:

```mermaid
graph TB
    subgraph "Phase 1: Authentication & User Context"
        P1[MaaS Authentication<br/>+ User Tier Resolution<br/>+ User Context Injection]
    end
    
    subgraph "Phase 2: Intelligent Model Access & Routing"
        P2[vSR → MaaS API Query<br/>+ Model Access Decision<br/>+ Constrained Semantic Routing]
    end
    
    subgraph "Phase 3: Streamlined Execution"
        P3[Rate Limiting<br/>+ Model Execution<br/>+ Usage Tracking]
    end
    
    subgraph "Phase 4: Intelligent Fallback (Conditional)"
        P4[Alternative Model Selection<br/>+ Retry Logic<br/>+ Cache Updates]
    end
    
    P1 --> P2
    P2 --> P3
    P3 --> P4
```

#### Phase 1: Authentication & User Context Generation

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as maas-default-gateway
    participant Kuadrant
    participant Authorino
    participant MaaSAPI as MaaS API
    
    Client->>Gateway: POST /chat/completions + Service Account Token
    Gateway->>Kuadrant: Apply Policies
    Kuadrant->>Authorino: Validate Service Account Token
    Authorino->>MaaSAPI: Tier lookup + User Identity
    MaaSAPI-->>Authorino: User tier (premium) + groups
    
    Authorino-->>Kuadrant: Auth Success + User Context
    Kuadrant-->>Gateway: Policy Decision (Allow) + Headers:<br/>X-User-ID: user-123<br/>X-Tier: premium<br/>X-Groups: tier-premium-users,specialists
```

**Benefits**: 
- ✅ **Simplified RHCL Flow**: No changes to existing Authorino/Limitador logic
- ✅ **Standard MaaS Authentication**: Maintains existing security and authentication patterns
- ✅ **User Context Injection**: Provides necessary headers for downstream vSR processing
- ✅ **Minimal Gateway Changes**: Leverages existing policy infrastructure

#### Phase 2: Intelligent Model Access Decision & Semantic Routing

```mermaid
sequenceDiagram
    participant Gateway as maas-default-gateway
    participant vSR as vSR ExtProc Service
    participant MaaSAPI as MaaS API
    participant Cache as Semantic Cache
    participant Client
    
    Gateway->>vSR: ExtProc Call with Request Body + User Context<br/>X-User-ID: user-123<br/>X-Tier: premium<br/>X-Groups: tier-premium-users
    
    vSR->>Cache: Check semantic cache (namespaced by X-User-ID)
    
    alt Cache Hit - Performance Boost
        Cache-->>vSR: Return cached response/routing decision
        vSR-->>Gateway: Cached routing decision
    else Cache Miss - Full Processing
        vSR->>vSR: 1. PII Detection & Redaction (Privacy Protection)
        vSR->>vSR: 2. Jailbreak Detection (Security Guard)
        
        alt Jailbreak Detected
            vSR-->>Gateway: HTTP 403 Forbidden (IMMEDIATE TERMINATION)
            Gateway-->>Client: 403 Forbidden - Security Violation
        else Request is Safe (PII Redacted)
            vSR->>MaaSAPI: GET /api/v1/users/user-123/accessible-models<br/>Query model access with RBAC + rate limits + token availability
            MaaSAPI->>MaaSAPI: Check user permissions, rate limits, token quotas
            MaaSAPI-->>vSR: Accessible models with status:<br/>{<br/>"accessible_models": ["llama3-70b", "llama3-8b"],<br/>"rate_limit_status": {<br/>"llama3-70b": {"available": true, "remaining_tokens": 85000},<br/>"llama3-8b": {"available": true, "remaining_tokens": 95000}<br/>}}</br>
            
            vSR->>vSR: 3. Semantic Classification (ModernBERT)
            vSR->>vSR: 4. Constrained Model Selection:<br/>- Parse accessible models from MaaS API<br/>- Apply tier-based preferences (premium tier)<br/>- Select optimal model from AVAILABLE set only
            vSR->>Cache: Store classification result (namespaced by user)
            vSR-->>Gateway: Header Modifications + Redacted Content:<br/>Host: llama3-70b-service<br/>X-MaaS-Model-Selected: llama3-70b<br/>X-Category: mathematics<br/>X-Confidence: 0.94<br/>X-VSR-Classification-Time: 45ms
        end
    end
```

**Benefits**: 
- 🧠 **Intelligent Access Decision**: MaaS API provides real-time model access with RBAC + rate limits + tokens
- 🔒 **Privacy Protection**: PII detection and redaction protects sensitive data  
- 🛡️ **Security Guard**: Jailbreak detection blocks malicious prompts
- ⚡ **Performance**: User-namespaced semantic caching prevents data leakage
- 👤 **Centralized Access Logic**: All model access decisions centralized in MaaS API
- 📊 **Real-time Availability**: Rate limit and token availability checked before routing
- 🚫 **Authorization Failure Elimination**: vSR only routes to accessible models

#### Phase 3: Model Execution & Usage Tracking

```mermaid
sequenceDiagram
    participant Gateway as maas-default-gateway
    participant KServe as Selected Model
    participant vSR as vSR ExtProc Service
    participant MaaSAPI as MaaS API
    participant Client
    
    Note over Gateway,Client: After vSR model selection (llama3-70b) - Access ALREADY VERIFIED
    Gateway->>KServe: Forward to Selected Model (llama3-70b)
    KServe->>KServe: Process Request & Generate Response
    KServe-->>Gateway: Model Response + Usage Metadata
    Gateway-->>Client: Model Response
    
    Note over vSR,MaaSAPI: Async Usage Tracking
    vSR->>MaaSAPI: POST /api/v1/users/user-123/usage<br/>Update token consumption:<br/>{<br/>"model": "llama3-70b",<br/>"tokens_used": 1500,<br/>"request_timestamp": "2026-01-22T10:30:00Z"<br/>}
    MaaSAPI->>MaaSAPI: Update user quotas & invalidate relevant cache entries
    MaaSAPI-->>vSR: Usage recorded successfully
```

**Benefits**: 
- ⚡ **Streamlined Execution**: Direct model execution with pre-verified access
- 📊 **Smart Cache Updates**: Real-time quota updates invalidate stale cache entries  
- 🔄 **Async Usage Tracking**: Non-blocking usage recording for performance
- 💰 **Accurate Billing**: Token consumption tracked per model and user

#### Phase 4: Intelligent Fallback Logic (Conditional)

```mermaid
sequenceDiagram
    participant Gateway as maas-default-gateway
    participant vSR as vSR ExtProc
    participant MaaSAPI as MaaS API
    participant Client
    
    Note over Gateway,Client: After model execution fails (llama3-70b quota exceeded during execution)
    Gateway->>vSR: Request fallback routing<br/>X-Original-Model: llama3-70b<br/>X-Failure-Reason: quota_exceeded
    
    vSR->>MaaSAPI: GET /api/v1/users/user-123/accessible-models<br/>Refresh model availability after quota consumption
    MaaSAPI->>MaaSAPI: Re-check quotas after recent consumption
    MaaSAPI-->>vSR: Updated accessible models:<br/>{<br/>"accessible_models": ["llama3-8b"],<br/>"rate_limit_status": {<br/>"llama3-70b": {"available": false, "remaining_tokens": 0},<br/>"llama3-8b": {"available": true, "remaining_tokens": 95000}<br/>}}
    
    alt Fallback Available
        vSR->>vSR: Select llama3-8b as fallback based on original classification
        vSR-->>Gateway: Fallback route + headers<br/>X-Fallback-Applied: true<br/>X-Original-Model: llama3-70b<br/>X-Fallback-Model: llama3-8b<br/>X-Fallback-Reason: quota_exceeded
        
        Note over Gateway: Retry execution with fallback model
        Gateway-->>Client: Fallback Model Response with Headers<br/>X-Model-Executed: llama3-8b<br/>X-Fallback-Applied: true
        
        Note over vSR,MaaSAPI: Update cache with fallback usage
        vSR->>MaaSAPI: POST /api/v1/users/user-123/usage (fallback model usage)
    else No Accessible Fallback
        Gateway-->>Client: 429 Too Many Requests<br/>All accessible models quota exceeded<br/>X-RateLimit-Reset-After: 3600
    end
```

**Benefits**: 
- 🔄 **Real-time Fallback**: Fresh quota checks ensure accurate fallback decisions
- 📊 **OpenAI-Compatible Responses**: Follows OpenAI rate limiting response format  
- 💰 **Cost Optimization**: Automatically downgrades to cheaper available models
- 🎯 **Improved UX**: Maintains service availability under quota pressure
- 🚫 **Access-Aware Fallback**: Fallback selection respects user permissions and quotas

### 2.2 Request Flow Headers

```http
# Phase 1: Client Request
POST /chat/completions
Authorization: Bearer sa-token-xyz
Content-Type: application/json
{"messages": [{"role": "user", "content": "Solve this calculus problem..."}]}

# Phase 1: After Authentication & User Context Injection
POST /chat/completions
Authorization: Bearer sa-token-xyz
X-User-ID: math-user-123                    # ✅ User identification
X-Tier: premium                             # ✅ User subscription tier
X-Groups: "tier-premium-users,specialists"  # ✅ Kubernetes groups for RBAC

# Phase 2: After vSR → MaaS API Model Access Decision & Semantic Routing
POST /models/llama3-70b/chat/completions    # 🆕 Path rewritten for model routing
Authorization: Bearer sa-token-xyz
X-User-ID: math-user-123                    # ✅ Passed through from Phase 1
X-Tier: premium                             # ✅ Passed through from Phase 1
X-MaaS-Model-Selected: llama3-70b          # 🆕 For billing tracking
X-Category: mathematics                     # 🆕 Semantic classification
X-Confidence: 0.94                         # 🆕 vSR classification confidence
X-VSR-Classification-Time: 45ms            # 🆕 vSR performance metrics
X-MaaS-Access-Check-Time: 12ms             # 🆕 MaaS API access check duration

# Phase 3: Successful Model Execution
HTTP/1.1 200 OK
Content-Type: application/json
X-Model-Executed: llama3-70b               # 🆕 Actually executed model
X-MaaS-Quota-Remaining: 83500              # 🆕 Remaining tokens after execution
X-Request-Duration: 2.5s
X-Tokens-Used: 1500                        # 🆕 Token consumption
{"choices": [{"message": {"content": "The derivative of x² is 2x..."}}]}
```

## 3. Implementation Strategy

### 3.1 Existing Infrastructure

The implementation leverages extensive existing production-ready infrastructure:

#### MaaS Platform (Production Ready)
- ✅ **MaaS API**: Go-based API with token management (ephemeral + named API keys)
- ✅ **Storage Options**: In-memory, disk, and external database storage modes
- ✅ **Gateway Policies**: AuthPolicy with tier resolution and RBAC integration
- ✅ **Model Discovery**: KServe InferenceService and LLMInferenceService discovery
- ✅ **User Management**: Tier-based access control (free/premium/enterprise)

#### vSR Platform (Production Ready)  
- ✅ **ExtProc Implementation**: Envoy External Processor gRPC service (port 50051)
- ✅ **vSR CLI**: Comprehensive deployment and management CLI
- ✅ **Kubernetes Deployment**: Complete K8s deployment manifests and Helm charts
- ✅ **Multi-Environment Support**: Local, Docker, Kubernetes deployment support
- ✅ **Security Features**: PII detection and jailbreak prevention capabilities

#### RHCL Platform (No Changes Required)
- ✅ **Authorino**: Service Account token validation with existing MaaS API tier lookup
- ✅ **Limitador**: Existing rate limiting infrastructure (unchanged)
- ✅ **Kuadrant**: Policy orchestration and header injection (unchanged)

### 3.2 Implementation Requirements

#### RHCL (Red Hat Connectivity Link) - No Changes Required
- ✅ **Token Validation**: Existing Kubernetes `TokenReview` for Service Account tokens (unchanged)
- ✅ **Tier Resolution**: Existing HTTP metadata lookup to MaaS API for user tier mapping (unchanged)
- ✅ **Context Injection**: Existing `X-User-ID`, `X-Tier`, `X-Groups` injection (unchanged)
- ✅ **Limitador Integration**: Existing rate limiting infrastructure (unchanged)

#### MaaS (Models-as-a-Service) - Centralized Model Access Logic
- ✅ **MaaS API**: Existing Go API with token management and tier resolution
- ✅ **Storage Configuration**: Existing in-memory, disk, and external database options
- ✅ **Token Management**: Existing ephemeral tokens and named API keys with expiration
- ✅ **Policy Infrastructure**: Existing AuthPolicy with tier-based enforcement
- 🆕 **Model Access Decision Engine**: New centralized engine combining RBAC + rate limits + token quotas
- 🆕 **Smart Access Cache**: New caching layer with intelligent quota-based invalidation
- 🆕 **Model Accessibility API**: New endpoint `/api/v1/users/{userId}/accessible-models`
- 🆕 **Usage Tracking API**: New endpoint `/api/v1/users/{userId}/usage` for real-time quota updates
- 🆕 **External Model Registry**: Enhanced model discovery beyond KServe (parallel work)
- 🆕 **Enhanced Billing Integration**: Updated billing collector for vSR usage patterns

#### vSR (vLLM Semantic Router) - MaaS API Integration
- ✅ **ExtProc Service**: Existing Envoy External Processor implementation (port 50051)
- ✅ **vSR CLI**: Existing deployment and management CLI (unchanged)
- ✅ **Kubernetes Infrastructure**: Existing deployment manifests (unchanged)
- ✅ **Security Features**: Existing PII detection and jailbreak prevention
- 🆕 **MaaS API Client**: New HTTP client for model access decisions
- 🆕 **Multi-Tenant Cache Enhancement**: User-namespaced semantic cache to prevent data leakage
- 🆕 **Usage Reporting**: New capability to report token consumption back to MaaS API
- 🆕 **Constrained Model Selection**: Parse MaaS API responses for intelligent routing

### 3.3 External Model Support Requirements (Parallel Work)

The integration requires extending MaaS to support external (non-KServe) models. This work can be developed in parallel to the core vSR integration:

#### MaaS API Components Requiring External Model Support:

1. **Model Discovery Service** (`internal/models/discovery.go`):
   - **Current**: Only discovers KServe `InferenceService` and `LLMInferenceService`
   - **Required**: Interface for external model registries
   - **Implementation**: Plugin-based discovery for vLLM, Ollama, external HTTP endpoints

2. **Model Registry** (`internal/models/registry.go` - new file):
   - **Required**: Unified model registry supporting:
     - KServe models (existing)
     - External HTTP endpoints with metadata
     - Model capabilities (pricing, rate limits, categories)
   - **API Endpoints**:
     ```
     POST /api/v1/models/register    # Register external model
     GET /api/v1/models             # List all models (KServe + external)
     PUT /api/v1/models/{id}        # Update model metadata
     DELETE /api/v1/models/{id}     # Remove external model
     ```

3. **Authorization Engine** (`internal/auth/model_access.go` - new file):
   - **Current**: RBAC only covers KServe resources (`InferenceService`, `LLMInferenceService`)
   - **Required**: RBAC rules for external models
   - **Implementation**: Custom resource types or extended RBAC mappings

4. **Gateway Routing** (`deployment/base/gateway/envoy-config.yaml`):
   - **Current**: Static KServe service routing
   - **Required**: Dynamic upstream configuration for external models
   - **Implementation**: Envoy cluster discovery integration

#### vSR Components Requiring External Model Support:

5. **Model Metadata Interface** (`pkg/models/metadata.go` - new file):
   - **Required**: Standard interface for model capabilities across providers
   - **Purpose**: Enable vSR routing decisions based on model characteristics
   - **Schema**:
     ```go
     type ModelMetadata struct {
         ID           string            `json:"id"`
         Provider     string            `json:"provider"`     // "kserve", "vllm", "ollama"
         Endpoint     string            `json:"endpoint"`
         Categories   []string          `json:"categories"`   // "math", "coding", "creative"
         Pricing      PricingInfo       `json:"pricing"`
         RateLimits   RateLimitInfo     `json:"rate_limits"`
         Capabilities ModelCapabilities `json:"capabilities"`
     }
     ```

6. **External Model Client** (`pkg/clients/external_models.go` - new file):
   - **Required**: HTTP client adapters for different external model providers
   - **Purpose**: Normalize API calls across different model providers

#### Specific File Locations for External Model Support:

```
maas/maas-api/
├── internal/
│   ├── models/
│   │   ├── discovery.go           # ← Extend for external discovery
│   │   ├── registry.go            # ← New unified registry
│   │   └── external_providers.go  # ← New provider interfaces
│   ├── auth/
│   │   └── model_access.go        # ← New RBAC for external models
│   └── handlers/
│       └── external_models.go     # ← New API handlers
├── pkg/
│   ├── models/
│   │   └── metadata.go            # ← New model metadata interface
│   └── clients/
│       └── external_models.go     # ← New external model clients
└── deployment/
    └── base/gateway/
        └── dynamic-config.yaml    # ← New dynamic routing config

vsr/src/semantic-router/
├── pkg/
│   ├── models/
│   │   ├── metadata.go            # ← Model metadata interface
│   │   └── external_adapter.go    # ← External model adapters
│   └── clients/
│       └── maas_client.go         # ← Enhanced MaaS API client
```

#### Parallel Development Opportunities:
- **External Model Registry**: Independent of vSR integration timeline
- **Dynamic Gateway Configuration**: Can be developed separately
- **Model Metadata Standards**: Can be defined as independent specification
- **Provider Client Libraries**: Modular development per provider

### 3.4 Migration Strategy

```mermaid
graph TB
    subgraph "Phase 1: Foundation (Immediate)"
        Current[Leverage Existing Infrastructure<br/>+ Enhanced Authorization<br/>+ Model Constraints]
    end
    
    subgraph "Phase 2: Enhancement (Short-term)"
        Enhanced[Plugin Architecture Development<br/>+ External Integration Layer<br/>+ Advanced Features]
    end
    
    subgraph "Phase 3: Ecosystem (Long-term)"
        Ecosystem[Full llm-d, Llama Stack,<br/>MCP Gateway Integration<br/>+ Production Optimization]
    end
    
    Current --> Enhanced
    Enhanced --> Ecosystem
```

#### Phase 1: Foundation (Immediate - 0-3 months)
1. **Implement MaaS API model access decision engine** with centralized RBAC + quota logic
2. **Add new MaaS API endpoints** for model accessibility and usage tracking
3. **Enhance vSR ExtProc** with MaaS API client and user-level caching
4. **Test end-to-end integration** with existing RHCL infrastructure (no changes required)

#### Phase 2: Enhancement (Short-term - 3-6 months)  
1. **Develop smart caching layer** with quota-based invalidation in MaaS API
2. **Implement intelligent fallback logic** with real-time quota checks
3. **Add external model registry** as parallel work stream
4. **Optimize performance** and add comprehensive monitoring

#### Phase 3: Ecosystem (Long-term - 6+ months)
1. **Complete external model integration** with dynamic gateway configuration
2. **Integrate with llm-d** for advanced model lifecycle management  
3. **Integrate with Llama Stack** for standardized model APIs
4. **Full production optimization** and enterprise-grade features

### 3.5 CLI Integration and Management

The integration leverages the existing comprehensive `vsr` CLI tool for deployment and management:

```bash
# Deploy vSR with MaaS integration configuration
vsr deploy kubernetes --namespace vsr-maas-integration \
  --config config/maas-integration.yaml \
  --with-extproc=true

# Validate integration configuration
vsr config validate --integration-mode=maas

# Monitor integration health
vsr health --check-maas-connectivity
vsr status --show-extproc-metrics

# Test MaaS API integration
vsr debug --test-maas-api-access
vsr debug --check-user-quotas --user-id=test-user

# Model management for integration
vsr model list --show-maas-metadata
vsr model validate --check-maas-accessibility

# View integration-specific logs
vsr logs --component=extproc --filter="maas-integration"
vsr logs --component=maas-client --follow
```

**Integration Configuration:**
```yaml
# config/maas-integration.yaml
integration:
  maas:
    enabled: true
    api_endpoint: "http://maas-api.maas-api.svc.cluster.local:8080"
    endpoints:
      accessible_models: "/api/v1/users/{userId}/accessible-models"
      usage_tracking: "/api/v1/users/{userId}/usage"
    timeout: "5s"
    retry_attempts: 3
    
  extproc:
    enabled: true
    port: 50051
    mode: "maas_integration"
    features:
      user_level_caching: true
      maas_api_integration: true
      usage_reporting: true
      fallback_logic: true
      
  plugins:
    security: true
    semantic: true  
    orchestration: false  # Disable if MCP Gateway handles this
    reasoning: false      # Can be enabled based on requirements
    
  cache:
    user_namespaced: true
    invalidation_on_usage: true
```

## 4. Error Handling and OpenAI Compatibility

The integration provides OpenAI-compatible error responses for seamless application integration:

### 4.1 Standard Error Responses

**Authentication Failure:**
```json
{
  "error": {
    "message": "Invalid authentication credentials",
    "type": "invalid_request_error", 
    "code": "invalid_api_key"
  }
}
```

**Quota Exceeded with Intelligent Fallback:**
```json
{
  "error": {
    "message": "Token quota exceeded for model llama3-70b. Using fallback model llama3-8b.",
    "type": "quota_exceeded_error",
    "code": "model_quota_exceeded",
    "param": "model",
    "fallback_applied": true,
    "fallback_model": "llama3-8b",
    "retry_after": null
  }
}
```

**All Models Quota Exceeded:**
```json
{
  "error": {
    "message": "Token quota exceeded for all accessible models. Please try again later.",
    "type": "quota_exceeded_error", 
    "code": "all_models_quota_exceeded",
    "retry_after": 3600
  }
}
```

**Security Violation:**
```json
{
  "error": {
    "message": "Request blocked for safety violations",
    "type": "policy_violation",
    "code": "content_policy_violation"
  }
}
```

### 4.2 OpenAI-Compatible Quota Headers

```http
X-RateLimit-Limit-Requests: 20        # Request limit for user/tier
X-RateLimit-Limit-Tokens: 100000      # Token quota limit for user/tier  
X-RateLimit-Remaining-Requests: 15    # Remaining requests in period
X-RateLimit-Remaining-Tokens: 85000   # Remaining token quota
X-RateLimit-Reset-Requests: 1674083820 # When request limit resets
X-RateLimit-Reset-Tokens: 1674083820  # When token quota resets
X-RateLimit-Reset-After: 60           # Seconds until quota reset
X-MaaS-Quota-Source: maas-api         # Source of quota information
```

## 5. Deployment Configurations

### 5.1 Hardware Resource Requirements

#### Production Deployment
```yaml
# vSR ExtProc Service
resources:
  requests:
    memory: "1Gi"
    cpu: "500m" 
  limits:
    memory: "2Gi"  
    cpu: "1000m"

# MaaS API Service
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"

# Authorization Cache (Redis/Valkey)
resources:
  requests:
    memory: "2Gi"
    cpu: "200m"
  limits:
    memory: "4Gi"
    cpu: "500m"
```

#### High-Throughput Deployment  
```yaml
# vSR ExtProc Service (High Throughput)
resources:
  requests:
    memory: "4Gi"
    cpu: "2000m"
  limits:
    memory: "8Gi"
    cpu: "4000m"

# MaaS API Service (High Availability)
replicas: 3
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### 5.2 Deployment Scenarios

#### Cost-Optimized Deployment
```yaml
vsr_integration:
  replicas: 1
  semantic_cache: "memory-only"
  reasoning_mode: "auto-disable"
  
maas_api:
  replicas: 2
  storage_mode: "disk"
  auth_cache_ttl: "600s"  # Longer cache for cost optimization
  
optimization:
  prefer_cheaper_models: true
  aggressive_fallback: true
  reasoning_mode_threshold: "high_budget_only"
```

#### Performance-Optimized Deployment  
```yaml
vsr_integration:
  replicas: 3
  semantic_cache: "redis-cluster"
  reasoning_mode: "always_available"
  
maas_api:
  replicas: 5
  storage_mode: "external"
  auth_cache_ttl: "300s"
  bulk_auth_parallelization: true
  
optimization:
  enable_prefetching: true
  aggressive_caching: true
  model_warmup: true
```

## 6. Benefits and Advantages

### 6.1 Immediate Advantages from Repository Alignment
- ✅ **Faster Implementation**: 60%+ of infrastructure already exists and is production-ready
- ✅ **Lower Risk**: Building on proven, tested components
- ✅ **Operational Readiness**: CLI tooling and deployment automation already available
- ✅ **Scalability**: Enterprise-grade foundation already established

### 6.2 Integration Benefits
- 🧠 **Intelligent Routing**: Semantic classification directs requests to optimal models based on real-time availability
- 🚫 **Authorization Failure Elimination**: MaaS API centralized logic ensures vSR only routes to accessible models
- ⚡ **Performance Optimization**: Single request parse, user-namespaced caching, direct MaaS API integration
- 🔐 **Enterprise Security**: PII detection, jailbreak prevention, comprehensive audit trails
- 💰 **Smart Cost Management**: Real-time quota tracking with intelligent fallback to cheaper models
- 🔧 **Simplified RHCL**: No changes required to existing Authorino/Limitador infrastructure
- 📊 **Operational Excellence**: Unified monitoring, CLI management, OpenAI compatibility
- 🎯 **Centralized Model Logic**: All model access decisions in MaaS API for consistency and maintainability

### 6.3 Future Extensibility
- 🔌 **Ecosystem Ready**: Prepared for llm-d, Llama Stack, MCP Gateway integration
- 📈 **Scalable Design**: Modular composition supports growth and evolution
- 🛠️ **Developer Experience**: Comprehensive tooling and clear interfaces
- 📋 **Standards Compliance**: OpenAI-compatible APIs and industry best practices

## 7. Conclusion

This design proposal presents a comprehensive integration strategy that combines the best of both MaaS and vSR platforms while maintaining architectural simplicity and operational efficiency. The refined architecture centralizes all model access logic in the MaaS API, eliminates unnecessary RHCL changes, and enables intelligent semantic routing with real-time quota awareness.

**Key Architectural Advantages:**
- **Simplified Integration**: No changes required to existing RHCL (Authorino/Limitador) infrastructure
- **Centralized Logic**: All model access decisions consolidated in MaaS API for consistency and maintainability
- **Real-time Intelligence**: vSR routing decisions based on live quota and availability data
- **Performance Optimized**: Single request parse with user-namespaced caching and direct API integration

The solution leverages extensive existing infrastructure, reducing implementation risk and time-to-market while preparing for future ecosystem evolution. With over 60% of the required infrastructure already production-ready and a clear separation of concerns, this approach delivers immediate value while establishing a robust foundation for long-term growth.

The centralized model access approach positions the integrated platform for success in the evolving LLM infrastructure landscape, providing a clean foundation for external model support and ecosystem integrations.