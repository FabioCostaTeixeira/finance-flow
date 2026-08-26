import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="glass-card text-center px-8 py-10 md:px-12 md:py-14 max-w-md w-full"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
          <Compass className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mb-2 text-4xl font-extrabold text-gradient-brand">404</h1>
        <p className="mb-6 text-base text-muted-foreground">
          Página não encontrada.
        </p>
        <a
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 cursor-pointer"
        >
          Voltar para o início
        </a>
      </motion.div>
    </div>
  );
};

export default NotFound;
