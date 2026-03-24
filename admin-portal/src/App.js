import React from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Drawer, List, ListItem, ListItemIcon, ListItemText, Divider, Box } from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon from '@mui/icons-material/People';
import CampaignIcon from '@mui/icons-material/Campaign';
import Login from './pages/Login';
import Stores from './pages/Stores';
import StoreLogs from './pages/StoreLogs';
import DriverManager from './pages/DriverManager';
import Accounting from './pages/Accounting';
import Customers from './pages/Customers';
import Promotions from './pages/Promotions';
import { useAuth } from './context/AuthContext';

const DRAWER_WIDTH = 240;

const navItems = [
  { text: 'Stores',    icon: <StoreIcon />,                link: '/stores'    },
  { text: 'Customers', icon: <PeopleIcon />,               link: '/customers' },
  { text: 'Drivers',  icon: <DirectionsCarIcon />,         link: '/drivers'   },
  { text: 'Promotions', icon: <CampaignIcon />,            link: '/promotions'},
  { text: 'Accounting',icon: <AccountBalanceWalletIcon />, link: '/accounting'},
  { text: 'Store Logs',icon: <DescriptionIcon />,          link: '/store-logs'},
];

function App() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Fikisha Admin Portal
          </Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Divider />
        <List>
          {navItems.map((item) => (
            <ListItem
              button
              key={item.text}
              component={NavLink}
              to={item.link}
              end={item.link === '/'}
              sx={{
                '&.active': { backgroundColor: 'action.selected', color: 'primary.main' },
                '&.active .MuiListItemIcon-root': { color: 'primary.main' },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem button onClick={logout}>
            <ListItemIcon><PersonIcon /></ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItem>
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Routes>
          <Route path="/login" element={<Navigate to="/stores" replace />} />
          <Route path="/" element={<Navigate to="/stores" replace />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/drivers" element={<DriverManager />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/store-logs" element={<StoreLogs />} />
          <Route path="*" element={<Navigate to="/stores" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;