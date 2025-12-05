import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { MessageCircle, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      toast.error('Erro ao enviar email. Tente novamente.');
      return;
    }

    setSent(true);
    toast.success('Link enviado! Verifique seu email.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Carlos Rodeiro CRM</h1>
          <p className="text-muted-foreground">Gestão de Atendimentos</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Recuperar senha</CardTitle>
            <CardDescription>
              {sent
                ? 'Verifique sua caixa de entrada'
                : 'Digite seu email para receber o link de recuperação'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <Mail className="h-8 w-8 text-success" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Enviamos um link de recuperação para <strong>{email}</strong>.
                  Verifique sua caixa de entrada e spam.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSent(false)}
                >
                  Enviar novamente
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
