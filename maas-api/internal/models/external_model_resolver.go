package models

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/opendatahub-io/models-as-a-service/maas-api/internal/logger"
)

// ExternalModelResolver resolves ExternalModel CRD names to spec.modelName.
type ExternalModelResolver struct {
	logger *logger.Logger
	client dynamic.Interface
}

// NewExternalModelResolver creates a new resolver backed by a dynamic client.
func NewExternalModelResolver(log *logger.Logger, client dynamic.Interface) *ExternalModelResolver {
	if log == nil {
		log = logger.Production()
	}
	return &ExternalModelResolver{logger: log, client: client}
}

// ResolveModelName looks up an inference.opendatahub.io ExternalModel and returns spec.modelName.
func (r *ExternalModelResolver) ResolveModelName(ctx context.Context, namespace, name string) string {
	if r.client == nil {
		return ""
	}
	gvr := schema.GroupVersionResource{
		Group:    "inference.opendatahub.io",
		Version:  "v1alpha1",
		Resource: "externalmodels",
	}
	obj, err := r.client.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		r.logger.Warn("failed to resolve ExternalModel model name", "namespace", namespace, "name", name, "error", err)
		return ""
	}
	modelName, _, err := unstructured.NestedString(obj.Object, "spec", "modelName")
	if err != nil {
		r.logger.Warn("failed to read spec.modelName from ExternalModel", "namespace", namespace, "name", name, "error", err)
		return ""
	}
	return modelName
}
