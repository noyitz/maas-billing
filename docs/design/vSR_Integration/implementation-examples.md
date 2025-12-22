# Implementation Examples

**Document**: Configuration and Code Examples for vSR-MaaS Integration  
**Date**: December 2025  
**Related**: [Main Design Proposal](design-proposal-vsr-maas-integration.md)

## Overview

This document contains the detailed configuration examples and code implementations referenced in the main design proposal for integrating vLLM Semantic Router with the Models-as-a-Service platform.

## Enhanced Authorization Policy Configuration

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

## vSR ExtProc Enhancement for Authorization Context

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

## Authorization Context Types

```go
// Authorization context structure
type AuthContext struct {
    UserID        string
    Tier          string
    Groups        []string
    AllowedModels []string
    MaxCost       float64
    BudgetRemaining float64
}

type RoutingDecision struct {
    Category      string
    SelectedModel string
    EstimatedCost float64
    UserContext   *AuthContext
    FallbackUsed  bool
    ReasonCode    string
}

// Model candidate for selection
type ModelCandidate struct {
    Name         string
    CostPerRequest float64
    Capabilities []string
    MinTier      string
}
```

## MaaS API Extensions

```go
// New MaaS API endpoint for model capabilities
func (api *MaaSAPI) HandleModelsAllowed(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Tier   string   `json:"tier"`
        Groups []string `json:"groups"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }
    
    // Get allowed models based on tier and group membership
    allowedModels := api.getAllowedModelsForTier(req.Tier, req.Groups)
    maxCost := api.getMaxCostPerRequest(req.Tier)
    
    response := struct {
        Models      []string `json:"models"`
        MaxCostPerRequest float64 `json:"maxCostPerRequest"`
    }{
        Models:      allowedModels,
        MaxCostPerRequest: maxCost,
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func (api *MaaSAPI) getAllowedModelsForTier(tier string, groups []string) []string {
    switch tier {
    case "free":
        return []string{"llama3.2-1b", "llama3.2-3b"}
    case "premium":
        return []string{"llama3.2-3b", "llama3-8b", "phi4-mini", "gpt-4o-mini"}
    case "enterprise":
        return []string{"llama3-8b", "llama3-70b", "phi4-mini", "gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet"}
    default:
        return []string{"llama3.2-1b"}
    }
}

func (api *MaaSAPI) getMaxCostPerRequest(tier string) float64 {
    switch tier {
    case "free":
        return 0.01    // $0.01 per request
    case "premium":
        return 0.50    // $0.50 per request
    case "enterprise":
        return 5.00    // $5.00 per request
    default:
        return 0.005   // $0.005 per request
    }
}
```

## Kubernetes RBAC Configuration

```yaml
# RBAC for semantic routing access
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: semantic-routing-user
rules:
- apiGroups: ["semantic-router.vllm.ai"]
  resources: ["semanticRouting"]
  verbs: ["use"]

---
# Enterprise tier users get semantic routing access
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: enterprise-semantic-routing
subjects:
- kind: Group
  name: tier-enterprise-users
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: semantic-routing-user
  apiGroup: rbac.authorization.k8s.io

---
# Premium tier users get semantic routing access
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: premium-semantic-routing
subjects:
- kind: Group
  name: tier-premium-users
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: semantic-routing-user
  apiGroup: rbac.authorization.k8s.io
```

## Service Account Token Configuration

```yaml
# Enhanced service accounts with semantic routing permissions
apiVersion: v1
kind: ServiceAccount
metadata:
  name: premium-user-sa
  namespace: premium-tier
  annotations:
    semantic-router.vllm.ai/allowed-models: "llama3-8b,phi4-mini,gpt-4o-mini"
    semantic-router.vllm.ai/max-cost-per-request: "0.50"
    semantic-router.vllm.ai/tier: "premium"

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: enterprise-user-sa
  namespace: enterprise-tier
  annotations:
    semantic-router.vllm.ai/allowed-models: "gpt-4o,claude-3.5-sonnet,llama3-70b"
    semantic-router.vllm.ai/max-cost-per-request: "5.00"
    semantic-router.vllm.ai/tier: "enterprise"
```

## Configuration Integration

```yaml
# vSR configuration with authorization support
config:
  authorization:
    enabled: true
    tier_header: "X-Tier"
    userid_header: "X-User-ID"
    allowed_models_header: "X-Allowed-Models"
    max_cost_header: "X-Max-Cost-Per-Request"
    
  model_selection:
    respect_tier_constraints: true
    enforce_budget_limits: true
    fallback_on_unauthorized: true
    
  security:
    require_authorization: true
    validate_model_access: true
    audit_unauthorized_attempts: true
```

This implementation provides the foundation for authorization-aware semantic routing while maintaining the security and operational principles of the MaaS platform.