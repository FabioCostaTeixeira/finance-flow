import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Insights page by default
    navigate('/insights');
  }, [navigate]);

  return null;
};

export default Index;
