/** Closed, addressed SignGraph carrier. Its component data are admitted by
 * SignCell, but the graph schema and graph construction live together here. */
import { defineSchemaType } from "@red-cup-engineering/signcell/type-system/schema-type";
import { typedMarkSchema, semanticReferenceSchema } from "@red-cup-engineering/signcell/semantic-carriers";

export const semanticGraphSchema = Object.freeze({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.561.group/computer/semantic-graph.schema.json",
  "title": "Semantic graph",
  "description": "A closed set of content-addressed cells with declared typed predicates and witnessed edges. Endpoint membership is checked by semantic graph admission.",
  "type": "object",
  "required": [
    "kind",
    "id",
    "cells",
    "relations",
    "edges"
  ],
  "additionalProperties": false,
  "properties": {
    "kind": {
      "const": "sign.graph"
    },
    "id": {
      "type": "string",
      "pattern": "^ni:"
    },
    "cells": {
      "type": "array",
      "items": {
        "$ref": "semantic-cell.schema.json"
      }
    },
    "relations": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/relation"
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/edge"
      }
    }
  },
  "$defs": {
    "relation": {
      "type": "object",
      "required": [
        "id",
        "subjectTypes",
        "objectTypes",
        "witnessTypes"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "subjectTypes": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "objectTypes": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "witnessTypes": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "edge": {
      "type": "object",
      "required": [
        "id",
        "edge"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^ni:"
        },
        "edge": {
          "type": "object",
          "required": [
            "subject",
            "predicate",
            "object",
            "witness"
          ],
          "additionalProperties": false,
          "properties": {
            "subject": {
              "$ref": "semantic-reference.schema.json"
            },
            "predicate": {
              "type": "string",
              "minLength": 1
            },
            "object": {
              "$ref": "semantic-reference.schema.json"
            },
            "witness": {
              "$ref": "semantic-reference.schema.json"
            }
          }
        }
      }
    }
  },
  "x-codegen": {
    "exportName": "semanticGraphSchema",
    "typeName": "SemanticGraph",
    "runtimeName": "semanticGraphType"
  }
});


export const semanticGraphType = defineSchemaType(semanticGraphSchema, [typedMarkSchema, semanticReferenceSchema]);
