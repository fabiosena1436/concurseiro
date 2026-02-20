import { Outlet } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { Header } from "./components/layout/Header";
import { GlobalStyles } from "./styles/GlobalStyles";
import { theme } from "./styles/theme";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Header />
      <main>
        <Outlet />
      </main>
    </ThemeProvider>
  );
}

export default App;
