import React from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Drawer, List, ListItem,
  ListItemIcon, ListItemText, Divider, Box,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StoreIcon from '@mui/icons-material/Store';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import PeopleIcon from '@mui/icons-material/People';
import CampaignIcon from '@mui/icons-material/Campaign';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import StoreLogs from './pages/StoreLogs';
import DriverManager from './pages/DriverManager';
import Accounting from './pages/Accounting';
import Payments from './pages/Payments';
import Customers from './pages/Customers';
import Promotions from './pages/Promotions';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Zones from './pages/Zones';
import Notifications from './pages/Notifications';
import SupportTickets from './pages/SupportTickets';
import { useAuth } from './context/AuthContext';

const DRAWER_WIDTH = 240;

const navSections = [
  {
    label: 'Operations',
    items: [
      { text: 'Dashboard',   icon: <DashboardIcon />,             link: '/'          },
      { text: 'Orders',      icon: <ShoppingCartIcon />,          link: '/orders'    },
      { text: 'Stores',      icon: <StoreIcon />,                 link: '/stores'    },
      { text: 'Drivers',     icon: <DirectionsCarIcon />,         link: '/drivers'   },
      { text: 'Customers',   icon: <PeopleIcon />,                link: '/customers' },
      { text: 'Zones',       icon: <MapIcon />,                   link: '/zones'     },
    ],
  },
  {
    label: 'Finance',
    items: [
      { text: 'Accounting',  icon: <AccountBalanceWalletIcon />,  link: '/accounting'},
      { text: 'Payments',    icon: <CreditCardIcon />,            link: '/payments'  },
      { text: 'Reports',     icon: <BarChartIcon />,              link: '/reports'   },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { text: 'Promotions',  icon: <CampaignIcon />,              link: '/promotions'},
      { text: 'Broadcasts',  icon: <NotificationsIcon />,         link: '/notifications'},
    ],
  },
  {
    label: 'Admin',
    items: [
      { text: 'Support Tickets', icon: <SupportAgentIcon />,      link: '/support-tickets' },
      { text: 'Audit Logs',  icon: <HistoryIcon />,               link: '/audit-logs'},
      { text: 'Store Logs',  icon: <DescriptionIcon />,           link: '/store-logs'},
      { text: 'Settings',    icon: <SettingsIcon />,              link: '/settings'  },
    ],
  },
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
            Mtaaexpress Admin Portal
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>{user.name || user.username}</Typography>
          <Button color="inherit" onClick={logout}>Logout</Button>
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
        {navSections.map((section) => (
          <React.Fragment key={section.label}>
            <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                {section.label}
              </Typography>
            </Box>
            <List dense>
              {section.items.map((item) => (
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
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItem>
              ))}
            </List>
            <Divider />
          </React.Fragment>
        ))}
        <List>
          <ListItem button onClick={logout}>
            <ListItemIcon sx={{ minWidth: 36 }}><PersonIcon /></ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItem>
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Routes>
          <Route path="/login"      element={<Navigate to="/" replace />} />
          <Route path="/"           element={<Dashboard />} />
          <Route path="/orders"     element={<Orders />} />
          <Route path="/stores"     element={<Stores />} />
          <Route path="/customers"  element={<Customers />} />
          <Route path="/drivers"    element={<DriverManager />} />
          <Route path="/zones"      element={<Zones />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/payments"   element={<Payments />} />
          <Route path="/reports"    element={<Reports />} />
          <Route path="/support-tickets" element={<SupportTickets />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/store-logs" element={<StoreLogs />} />
          <Route path="/settings"   element={<Settings />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
