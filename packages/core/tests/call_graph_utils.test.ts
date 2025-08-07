import { describe, test, expect } from "vitest";
import { apply_max_depth_filter, is_position_within_range, get_function_node_range } from "../src/call_graph_utils";
import { CallGraphNode, CallGraphEdge, SimpleRange } from "../src/graph";

describe("call_graph_utils", () => {
  describe("apply_max_depth_filter", () => {
    test("filters nodes and edges by depth from top-level nodes", () => {
      // Create a simple graph: A -> B -> C -> D
      const nodes = new Map<string, CallGraphNode>();
      
      const nodeA: CallGraphNode = {
        symbol: 'A',
        definition: {} as any,
        calls: [{ symbol: 'B', range: {} as any, kind: 'function' }],
        called_by: []
      };
      
      const nodeB: CallGraphNode = {
        symbol: 'B',
        definition: {} as any,
        calls: [{ symbol: 'C', range: {} as any, kind: 'function' }],
        called_by: ['A']
      };
      
      const nodeC: CallGraphNode = {
        symbol: 'C',
        definition: {} as any,
        calls: [{ symbol: 'D', range: {} as any, kind: 'function' }],
        called_by: ['B']
      };
      
      const nodeD: CallGraphNode = {
        symbol: 'D',
        definition: {} as any,
        calls: [],
        called_by: ['C']
      };
      
      nodes.set('A', nodeA);
      nodes.set('B', nodeB);
      nodes.set('C', nodeC);
      nodes.set('D', nodeD);
      
      const edges: CallGraphEdge[] = [
        { from: 'A', to: 'B', location: {} as any },
        { from: 'B', to: 'C', location: {} as any },
        { from: 'C', to: 'D', location: {} as any }
      ];
      
      const topLevelNodes = ['A'];
      
      // Test max_depth = 2 (should include A, B, C but not D)
      const result = apply_max_depth_filter(nodes, edges, topLevelNodes, 2);
      
      expect(result.nodes.size).toBe(3);
      expect(result.nodes.has('A')).toBe(true);
      expect(result.nodes.has('B')).toBe(true);
      expect(result.nodes.has('C')).toBe(true);
      expect(result.nodes.has('D')).toBe(false);
      
      expect(result.edges.length).toBe(2);
      expect(result.edges.some(e => e.from === 'A' && e.to === 'B')).toBe(true);
      expect(result.edges.some(e => e.from === 'B' && e.to === 'C')).toBe(true);
      expect(result.edges.some(e => e.from === 'C' && e.to === 'D')).toBe(false);
    });

    test("handles multiple top-level nodes", () => {
      // Create a graph with two disconnected subgraphs
      const nodes = new Map<string, CallGraphNode>();
      
      const nodeA: CallGraphNode = {
        symbol: 'A',
        definition: {} as any,
        calls: [{ symbol: 'B', range: {} as any, kind: 'function' }],
        called_by: []
      };
      
      const nodeB: CallGraphNode = {
        symbol: 'B',
        definition: {} as any,
        calls: [],
        called_by: ['A']
      };
      
      const nodeX: CallGraphNode = {
        symbol: 'X',
        definition: {} as any,
        calls: [{ symbol: 'Y', range: {} as any, kind: 'function' }],
        called_by: []
      };
      
      const nodeY: CallGraphNode = {
        symbol: 'Y',
        definition: {} as any,
        calls: [],
        called_by: ['X']
      };
      
      nodes.set('A', nodeA);
      nodes.set('B', nodeB);
      nodes.set('X', nodeX);
      nodes.set('Y', nodeY);
      
      const edges: CallGraphEdge[] = [
        { from: 'A', to: 'B', location: {} as any },
        { from: 'X', to: 'Y', location: {} as any }
      ];
      
      const topLevelNodes = ['A', 'X'];
      
      // Test max_depth = 1 (should include all nodes since they're all within depth 1)
      const result = apply_max_depth_filter(nodes, edges, topLevelNodes, 1);
      
      expect(result.nodes.size).toBe(4);
      expect(result.edges.length).toBe(2);
    });
  });

  describe("is_position_within_range", () => {
    test("returns true when position is within range", () => {
      const position: SimpleRange = {
        start: { row: 5, column: 10 },
        end: { row: 5, column: 20 }
      };
      
      const range: SimpleRange = {
        start: { row: 1, column: 0 },
        end: { row: 10, column: 50 }
      };
      
      expect(is_position_within_range(position, range)).toBe(true);
    });

    test("returns false when position is before range", () => {
      const position: SimpleRange = {
        start: { row: 0, column: 5 },
        end: { row: 0, column: 10 }
      };
      
      const range: SimpleRange = {
        start: { row: 1, column: 0 },
        end: { row: 10, column: 50 }
      };
      
      expect(is_position_within_range(position, range)).toBe(false);
    });

    test("returns false when position is after range", () => {
      const position: SimpleRange = {
        start: { row: 11, column: 0 },
        end: { row: 11, column: 10 }
      };
      
      const range: SimpleRange = {
        start: { row: 1, column: 0 },
        end: { row: 10, column: 50 }
      };
      
      expect(is_position_within_range(position, range)).toBe(false);
    });

    test("handles edge cases on same line", () => {
      const position: SimpleRange = {
        start: { row: 5, column: 10 },
        end: { row: 5, column: 20 }
      };
      
      const range: SimpleRange = {
        start: { row: 5, column: 0 },
        end: { row: 5, column: 30 }
      };
      
      expect(is_position_within_range(position, range)).toBe(true);
      
      // Position starts before range on same line
      const position2: SimpleRange = {
        start: { row: 5, column: 0 },
        end: { row: 5, column: 20 }
      };
      
      const range2: SimpleRange = {
        start: { row: 5, column: 10 },
        end: { row: 5, column: 30 }
      };
      
      expect(is_position_within_range(position2, range2)).toBe(false);
    });
  });

  describe("get_function_node_range", () => {
    test("returns range for valid node", () => {
      const node = {
        startPosition: { row: 5, column: 10 },
        endPosition: { row: 8, column: 20 }
      };
      
      const range = get_function_node_range(node);
      
      expect(range).toEqual({
        start: { row: 5, column: 10 },
        end: { row: 8, column: 20 }
      });
    });

    test("returns null for null node", () => {
      const range = get_function_node_range(null);
      expect(range).toBeNull();
    });

    test("returns null for undefined node", () => {
      const range = get_function_node_range(undefined);
      expect(range).toBeNull();
    });
  });
});