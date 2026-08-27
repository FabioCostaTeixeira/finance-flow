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
import { Loader2, LogIn, KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import logo from '@/assets/logo.jpg';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

const firstAccessSchema = z.object({
  email: z.string().email('Email inválido'),
});

const newPasswordSchema = z.object({
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmação de senha deve ter no mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthMode = 'login' | 'first-access' | 'new-password';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accessSent, setAccessSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Detecta se o usuário acessou por um link de recuperação/primeiro acesso (#access_token=... ou tipo recovery)
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('type=invite'))) {
      setMode('new-password');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('new-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Se o usuário já está logado e NÃO está no fluxo de redefinição de senha, navega para /receitas
    if (user && mode !== 'new-password') {
      navigate('/receitas');
    }
  }, [user, mode, navigate]);

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
      firstAccessSchema.parse({ email });
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

  const validateNewPasswordForm = () => {
    try {
      newPasswordSchema.parse({ password, confirmPassword });
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
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        toast({
          title: 'Erro',
          description: error.message || 'Não foi possível solicitar o primeiro acesso.',
          variant: 'destructive',
        });
        return;
      }

      setAccessSent(true);
      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada para criar sua senha de acesso.',
      });
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

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNewPasswordForm()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          title: 'Erro ao cadastrar senha',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Senha cadastrada!',
        description: 'Sua nova senha foi criada com sucesso.',
      });

      navigate('/receitas');
    } catch {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar sua senha.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, hsl(var(--accent-vibrant) / 0.16), transparent 45%), radial-gradient(circle at 80% 80%, hsl(var(--primary) / 0.14), transparent 45%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
        className="glass-card relative z-10 w-full max-w-md"
      >
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src={logo}
              alt="Mary Personal"
              className="h-20 w-20 object-cover rounded-full shadow-lg ring-2 ring-primary/30"
            />
          </div>
          <CardTitle className="text-2xl text-gradient-brand">Financeiro MarySysten</CardTitle>
          <CardDescription>
            {mode === 'login' && 'Entre com suas credenciais para acessar o sistema'}
            {mode === 'first-access' && 'Solicite um link para cadastrar sua senha de acesso'}
            {mode === 'new-password' && 'Crie sua nova senha de acesso'}
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
                        setAccessSent(false);
                        setMode('first-access');
                      }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Primeiro acesso / Esqueci a senha
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

                <Button type="submit" className="w-full min-h-[44px]" disabled={isLoading}>
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
                    className="w-full"
                    onClick={() => {
                      setErrors({});
                      setAccessSent(false);
                      setMode('first-access');
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Primeiro Acesso (Criar Senha)
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
                {accessSent ? (
                  <div className="text-center space-y-4 py-4">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                    <h3 className="font-semibold text-lg">Link enviado com sucesso!</h3>
                    <p className="text-sm text-muted-foreground">
                      Enviamos as instruções para <span className="font-medium text-foreground">{email}</span>. Acesse a mensagem e clique no link fornecido para criar sua senha.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => {
                        setAccessSent(false);
                        setMode('login');
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar para o Login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleFirstAccessSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-access-email">Seu e-mail cadastrado</Label>
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

                    <Button type="submit" className="w-full min-h-[44px]" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Enviar link de cadastro de senha
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

            {mode === 'new-password' && (
              <motion.form
                key="new-password-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleNewPasswordSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input
                    id="new-password"
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
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input
                    id="confirm-password"
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

                <Button type="submit" className="w-full min-h-[44px]" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando Senha...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Salvar Senha e Acessar
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </motion.div>
    </div>
  );
}