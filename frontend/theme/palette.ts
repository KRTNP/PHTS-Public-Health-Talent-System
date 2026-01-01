/**
 * PHTS System - Color Palette
 *
 * Medical Clean Theme - Professional, Trustworthy, Minimalist
 * Optimized for hospital/healthcare environments
 *
 * Primary: Deep Teal (#00695f) - Conveys trust, professionalism, healthcare
 * Background: Light Gray (#F4F6F8) - Reduces eye strain for long sessions
 */

import { PaletteOptions } from '@mui/material/styles';

// New medical/enterprise blue palette
const primary = {
  lighter: '#D1E9FC',
  light: '#76B0F1',
  main: '#1976D2',
  dark: '#0D47A1',
  darker: '#082A66',
  contrastText: '#FFFFFF',
};

const secondary = {
  lighter: '#D6E4FF',
  light: '#84A9FF',
  main: '#3366FF',
  dark: '#1939B7',
  darker: '#091A7A',
  contrastText: '#FFFFFF',
};

const error = {
  lighter: '#FFE7D9',
  light: '#FFA48D',
  main: '#FF4842',
  dark: '#B72136',
  darker: '#7A0C2E',
  contrastText: '#FFFFFF',
};

const success = {
  lighter: '#E9FCD4',
  light: '#AAF27F',
  main: '#54D62C',
  dark: '#229A16',
  darker: '#08660D',
  contrastText: '#212B36',
};

const grey = {
  0: '#FFFFFF',
  100: '#F9FAFB',
  200: '#F4F6F8',
  300: '#DFE3E8',
  400: '#C4CDD5',
  500: '#919EAB',
  600: '#637381',
  700: '#454F5B',
  800: '#212B36',
  900: '#161C24',
};

export const palette: PaletteOptions = {
  primary,
  secondary,
  error,
  success,
  grey,
  text: {
    primary: grey[800],
    secondary: grey[700],
    disabled: grey[500],
  },
  background: {
    default: '#F4F6F8',
    paper: '#FFFFFF',
  },
  divider: grey[300],
};
