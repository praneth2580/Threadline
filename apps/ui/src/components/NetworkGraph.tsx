import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';

export interface GraphNode {
  id: string;
  name: string;
  platform?: string;
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

type DbRow = Record<string, string>;

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

async function fetchGraphData(): Promise<GraphData> {
  if (!isTauri()) return { nodes: [], links: [] };
  const { invoke } = await import('@tauri-apps/api/tauri');
  const [accounts, relations, connected] = await Promise.all([
    invoke<DbRow[]>('db_get_accounts'),
    invoke<DbRow[]>('db_get_relations'),
    invoke<DbRow[]>('db_get_connected_accounts'),
  ]);
  const nodes: GraphNode[] = (accounts || []).map((row) => ({
    id: String(row.id),
    name: row.username || row.id,
    platform: row.platform,
    val: 6,
  }));
  const links: GraphLink[] = [];
  (relations || []).forEach((row) => {
    links.push({
      source: String(row.source_account_id),
      target: String(row.destination_account_id),
    });
  });
  (connected || []).forEach((row) => {
    links.push({
      source: String(row.account_id_1),
      target: String(row.account_id_2),
    });
  });
  return { nodes, links };
}

const EMPTY_PLACEHOLDER: GraphData = {
  nodes: [
    { id: '1', name: 'Your network', platform: undefined, val: 8 },
    { id: '2', name: 'Accounts', platform: undefined, val: 5 },
    { id: '3', name: 'Connections', platform: undefined, val: 5 },
  ],
  links: [
    { source: '1', target: '2' },
    { source: '1', target: '3' },
    { source: '2', target: '3' },
  ],
};

interface NetworkGraphProps {
  width?: number;
  height?: number;
  refreshTrigger?: number; // increment to refetch (e.g. from parent)
}

export function NetworkGraph({ width = 800, height = 600, refreshTrigger = 0 }: NetworkGraphProps) {
  const theme = useTheme();
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [usePlaceholder, setUsePlaceholder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await fetchGraphData();
      if (graph.nodes.length > 0) {
        setData(graph);
        setUsePlaceholder(false);
      } else {
        setData(EMPTY_PLACEHOLDER);
        setUsePlaceholder(true);
      }
    } catch {
      setData(EMPTY_PLACEHOLDER);
      setUsePlaceholder(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const bgColor =
    theme.palette.mode === 'dark'
      ? theme.palette.background.paper
      : theme.palette.background.default;

  const nodeLabel = useCallback((node: GraphNode) => {
    const n = node as GraphNode;
    return n.platform ? `${n.name} (${n.platform})` : n.name;
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          width: width || '100%',
          height: height || 640,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: bgColor,
          borderRadius: 1,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: width || '100%', height: height || 640 }}>
      <ForceGraph3D
        graphData={data}
        nodeLabel={nodeLabel}
        nodeVal="val"
        width={width || 1100}
        height={height || 640}
        backgroundColor={bgColor}
      />
      {usePlaceholder && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2,
            py: 1,
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: 1,
            maxWidth: '90%',
          }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Add accounts and connections from the scraper or database to build your network graph.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
