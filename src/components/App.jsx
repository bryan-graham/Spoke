import PropTypes from "prop-types";
import React, { useMemo, useState } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { createTheme } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";

import { buildThemeOptions, defaultTheme } from "../styles/mui-theme";
import ThemeContext from "../containers/context/ThemeContext";
import { ColorSchemeContext, useColorSchemeState } from "./ColorScheme";

/**
 * Organizations may customize colors but not other parts of the theme. The
 * organization's saved theme (a JSON string or object with a `palette`) is
 * merged into Shore's theme for the current color scheme (light or dark).
 */
const paletteFromOrgTheme = orgTheme => {
  if (!orgTheme) {
    return null;
  }
  const parsed = typeof orgTheme === "string" ? JSON.parse(orgTheme) : orgTheme;
  return (parsed && parsed.palette) || null;
};

const App = ({ children }) => {
  const colorScheme = useColorSchemeState();
  const [orgPalette, setOrgPalette] = useState(null);

  const muiTheme = useMemo(() => {
    try {
      // If a bad palette is saved this will fail.
      return createTheme(buildThemeOptions(colorScheme.scheme, orgPalette));
    } catch (e) {
      console.error("failed to create theme", orgPalette);
      return createTheme(buildThemeOptions(colorScheme.scheme));
    }
  }, [colorScheme.scheme, orgPalette]);

  const handleSetTheme = newTheme => {
    if (newTheme === undefined) {
      // happens when OrganizationWrapper unmounts
      setOrgPalette(null);
    } else {
      try {
        setOrgPalette(paletteFromOrgTheme(newTheme));
      } catch (e) {
        console.error("Failed to parse theme: ", newTheme);
      }
    }
  };

  return (
    <ColorSchemeContext.Provider value={colorScheme}>
      <ThemeContext.Provider value={{ muiTheme, setTheme: handleSetTheme }}>
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
          <div styles={{ height: "100%" }}>{children}</div>
        </ThemeProvider>
      </ThemeContext.Provider>
    </ColorSchemeContext.Provider>
  );
};

App.propTypes = {
  children: PropTypes.object
};

export { defaultTheme };

export default App;
