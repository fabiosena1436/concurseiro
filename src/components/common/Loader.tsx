import { Box, CircularProgress, Typography } from '@mui/material';

interface LoaderProps {
  children?: React.ReactNode;
}

export const Loader: React.FC<LoaderProps> = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        py: 4,
        gap: 2
      }}
    >
      <CircularProgress />
      {children && <Typography>{children}</Typography>}
    </Box>
  );
};
