import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const LoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.medium};
  padding: ${(props) => props.theme.spacing.large};
`;

const Spinner = styled.div`
  border: 4px solid #f3f3f3;
  border-top: 4px solid ${(props) => props.theme.colors.primary};
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: ${spin} 1s linear infinite;
`;

interface LoaderProps {
  children?: React.ReactNode;
}

export const Loader: React.FC<LoaderProps> = ({ children }) => {
  return (
    <LoaderContainer>
      <Spinner />
      {children && <p>{children}</p>}
    </LoaderContainer>
  );
};
