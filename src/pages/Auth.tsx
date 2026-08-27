import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import logo from '@/assets/logo.png';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

const firstAccessSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmação de senha deve ter no mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthMode = 'login' | 'first-access';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/receitas');
    }
  }, [user, navigate]);

  const validateLoginForm = () => {
    try {
      loginSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateFirstAccessForm = () => {
    try {
      firstAccessSchema.parse({ email, password, confirmPassword });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        let errorMessage = 'Erro ao fazer login';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Por favor, confirme seu email antes de fazer login';
        }
        
        toast({
          title: 'Erro',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });
      
      navigate('/receitas');
    } catch {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFirstAccessForm()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('public-auth', {
        body: {
          action: 'first_access',
          email,
          password,
        },
      });

      if (error || data?.error) {
        toast({
          title: 'Erro no cadastro',
          description: data?.error || error?.message || 'Não foi possível cadastrar a senha.',
          variant: 'destructive',
        });
        return;
      }

      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setSuccessMessage(true);
        toast({
          title: 'Senha cadastrada com sucesso!',
          description: 'Sua senha foi salva. Faça login com suas novas credenciais.',
        });
      } else {
        toast({
          title: 'Bem-vindo!',
          description: 'Senha criada e login realizado com sucesso!',
        });
        navigate('/receitas');
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado ao definir a senha.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* Ambient LED glow backgrounds */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(0, 229, 255, 0.15), transparent 45%), radial-gradient(circle at 70% 80%, rgba(56, 189, 248, 0.12), transparent 45%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
        className="glass-card relative z-10 w-full max-w-md border border-cyan-500/20 shadow-[0_0_50px_-10px_rgba(0,229,255,0.15)]"
      >
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src={logo}
              alt="Finance Flow"
              className="h-20 w-20 object-contain drop-shadow-[0_0_16px_rgba(0,229,255,0.5)]"
            />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-gradient-brand">Finance Flow</CardTitle>
          <CardDescription className="text-slate-400">
            {mode === 'login' && 'Entre com suas credenciais para acessar a plataforma'}
            {mode === 'first-access' && 'Digite seu e-mail cadastrado e defina sua nova senha'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLoginSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Senha</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrors({});
                        setPassword('');
                        setConfirmPassword('');
                        setMode('first-access');
                      }}
                      className="text-xs text-cyan-400 hover:underline font-medium"
                    >
                      Primeiro Acesso / Definir Senha
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <Button type="submit" className="w-full min-h-[44px] shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_25px_rgba(0,229,255,0.5)] transition-all" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>

                <div className="pt-2 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10 text-cyan-300"
                    onClick={() => {
                      setErrors({});
                      setPassword('');
                      setConfirmPassword('');
                      setMode('first-access');
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4 text-cyan-400" />
                    Primeiro Acesso (Criar Senha Direta)
                  </Button>
                </div>
              </motion.form>
            )}

            {mode === 'first-access' && (
              <motion.div
                key="first-access-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {successMessage ? (
                  <div className="text-center space-y-4 py-4">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" />
                    <h3 className="font-semibold text-lg">Senha Cadastrada!</h3>
                    <p className="text-sm text-muted-foreground">
                      Sua senha foi cadastrada com sucesso. Clique abaixo para entrar com suas credenciais.
                    </p>
                    <Button
                      type="button"
                      variant="default"
                      className="w-full mt-2 shadow-[0_0_20px_rgba(0,229,255,0.3)]"
                      onClick={() => {
                        setSuccessMessage(false);
                        setMode('login');
                      }}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Ir para o Login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleFirstAccessSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-access-email">E-mail Cadastrado</Label>
                      <Input
                        id="first-access-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="first-access-password">Nova Senha</Label>
                      <Input
                        id="first-access-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className={errors.password ? 'border-destructive' : ''}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="first-access-confirm-password">Confirmar Nova Senha</Label>
                      <Input
                        id="first-access-confirm-password"
                        type="password"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        className={errors.confirmPassword ? 'border-destructive' : ''}
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full min-h-[44px] shadow-[0_0_20px_rgba(0,229,255,0.3)]" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cadastrando Senha...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Criar Senha e Entrar
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setErrors({});
                        setMode('login');
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar para o Login
                    </Button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </motion.div>
    </div>
  );
}