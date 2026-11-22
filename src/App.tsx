import { Outlet } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Header } from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import { Box } from "@mui/material";

const theme = createTheme({
  palette: {
    primary: { main: '#1746a2', dark: '#102f71', light: '#e8efff' },
    secondary: { main: '#c26815' },
    background: { default: '#f6f8fc', paper: '#ffffff' },
    text: { primary: '#17243b', secondary: '#52617a' },
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.035em' },
    h2: { fontWeight: 800, letterSpacing: '-0.03em' },
    h4: { fontWeight: 750, letterSpacing: '-0.025em' },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 44 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <Box component="main" sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
        <Footer />
      </Box>
    </ThemeProvider>
  );
}

export default App;
