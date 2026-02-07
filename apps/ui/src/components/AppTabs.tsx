import { Box, Tab, Tabs } from '@mui/material';
import { ReactNode, useState } from 'react';
import { NetworkGraph } from './NetworkGraph';
import { SessionsTab } from './SessionsTab';

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`app-tabpanel-${index}`} aria-labelledby={`app-tab-${index}`}>
      {value === index && <Box sx={{ py: 2, height: '100%' }}>{children}</Box>}
    </div>
  );
}

export function AppTabs() {
  const [value, setValue] = useState(0);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        value={value}
        onChange={(_, v) => setValue(v)}
        aria-label="App sections"
        sx={{ minHeight: 48, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Graph" id="app-tab-0" aria-controls="app-tabpanel-0" />
        <Tab label="Sessions" id="app-tab-1" aria-controls="app-tabpanel-1" />
        <Tab label="Accounts" id="app-tab-2" aria-controls="app-tabpanel-2" />
        <Tab label="Connections" id="app-tab-3" aria-controls="app-tabpanel-3" />
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TabPanel value={value} index={0}>
          <Box sx={{ height: 640, width: '100%', maxWidth: 1100, mx: 'auto' }}>
            <NetworkGraph width={1100} height={640} />
          </Box>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <SessionsTab />
        </TabPanel>
        <TabPanel value={value} index={2}>
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            Accounts view — connect the scraper to populate from the database.
          </Box>
        </TabPanel>
        <TabPanel value={value} index={3}>
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            Connections view — relations and connected accounts will appear here.
          </Box>
        </TabPanel>
      </Box>
    </Box>
  );
}
