import ForceGraph3D from 'react-force-graph-3d';

export interface GraphNode {
  id: string;
  name: string;
  val?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const defaultData: GraphData = {
  nodes: [
    { id: '1', name: 'Node A', val: 8 },
    { id: '2', name: 'Node B', val: 6 },
    { id: '3', name: 'Node C', val: 4 },
    { id: '4', name: 'Node D', val: 5 },
    { id: '5', name: 'Node E', val: 3 },
  ],
  links: [
    { source: '1', target: '2' },
    { source: '1', target: '3' },
    { source: '2', target: '3' },
    { source: '2', target: '4' },
    { source: '3', target: '4' },
    { source: '4', target: '5' },
  ],
};

interface NetworkGraphProps {
  data?: GraphData;
  width?: number;
  height?: number;
}

export function NetworkGraph({ data = defaultData, width = 800, height = 600 }: NetworkGraphProps) {
  return (
    <ForceGraph3D
      graphData={data}
      nodeLabel="name"
      nodeVal="val"
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
    />
  );
}
