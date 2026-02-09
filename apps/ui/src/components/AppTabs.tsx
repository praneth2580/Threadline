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
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`app-tabpanel-${index}`}
      aria-labelledby={`app-tab-${index}`}
      style={{ height: '100%', minHeight: 0, overflow: 'auto' }}
    >
      {value === index && (
        <Box sx={{ py: { xs: 1.5, sm: 2 }, height: '100%', minHeight: 0, overflow: 'auto' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export function AppTabs() {
  const [value, setValue] = useState(0);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Tabs
        value={value}
        onChange={(_, v) => setValue(v)}
        aria-label="App sections"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 48,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          '& .MuiTab-root': { minWidth: 'auto', px: { xs: 1.5, sm: 2 } },
        }}
      >
        <Tab label="Graph" id="app-tab-0" aria-controls="app-tabpanel-0" />
        <Tab label="Sessions" id="app-tab-1" aria-controls="app-tabpanel-1" />
        <Tab label="Accounts" id="app-tab-2" aria-controls="app-tabpanel-2" />
        <Tab label="Connections" id="app-tab-3" aria-controls="app-tabpanel-3" />
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TabPanel value={value} index={0}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 1100,
              mx: 'auto',
              flex: 1,
              minHeight: { xs: 280, sm: 400, md: 560 },
              height: '100%',
              px: { xs: 1, sm: 2 },
            }}
          >
            <NetworkGraph />
          </Box>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <SessionsTab />
        </TabPanel>
        <TabPanel value={value} index={2}>
          <Box sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', color: 'text.secondary' }}>
            Accounts view — connect the scraper to populate from the database.
          </Box>
        </TabPanel>
        <TabPanel value={value} index={3}>
          <Box sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', color: 'text.secondary' }}>
            Connections view — relations and connected accounts will appear here.
          </Box>
        </TabPanel>
      </Box>
    </Box>
  );
}
