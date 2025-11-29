import React, { useState } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleGoogleLogin = () => {
    // Nota: Em produção, você usaria o google.accounts.id.initialize aqui.
    // Como é uma demo sem domínio verificado, usamos o mock.
    /*
    // Exemplo de implementação real (Requer CLIENT_ID no index.html):
    window.google?.accounts.id.initialize({
      client_id: "SEU_CLIENT_ID_DO_GOOGLE_CLOUD",
      callback: (response: any) => {
        // Decodificar JWT e logar
      }
    });
    window.google?.accounts.id.prompt();
    */

    const mockUser: User = {
        id: 'google-mock-id',
        name: "Usuário Google",
        email: "usuario@gmail.com",
        picture: "https://lh3.googleusercontent.com/a/default-user=s96-c"
    };
    onLogin(mockUser);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
        let user: User;
        if (isRegistering) {
            if (!name || !email || !password) throw new Error("Preencha todos os campos.");
            user = await authService.register(name, email, password);
        } else {
            if (!email || !password) throw new Error("Preencha e-mail e senha.");
            user = await authService.login(email, password);
        }
        
        // Lógica simples de "Lembrar de mim" (poderia salvar token em localStorage em um app real)
        if (rememberMe && !isRegistering) {
            localStorage.setItem('rotaai_remember_email', email);
        } else if (!isRegistering) {
            localStorage.removeItem('rotaai_remember_email');
        }

        onLogin(user);
    } catch (err: any) {
        setError(err.message || "Ocorreu um erro.");
    } finally {
        setLoading(false);
    }
  };

  // Pre-fill email se "Lembrar de mim" foi usado antes
  React.useEffect(() => {
    const savedEmail = localStorage.getItem('rotaai_remember_email');
    if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 100 L20 80 L40 90 L60 70 L80 85 L100 60" stroke="white" strokeWidth="0.5" fill="none"/>
            <path d="M10 0 L30 40 L50 20 L70 50 L90 30" stroke="white" strokeWidth="0.5" fill="none"/>
         </svg>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md z-10 mx-4 transition-all duration-300">
        <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center shadow-lg mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">RotaInteligente AI</h1>
            <p className="text-slate-500 mt-1">{isRegistering ? 'Crie sua conta para começar' : 'Bem-vindo de volta'}</p>
        </div>

        {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nome Completo</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Seu nome"
                    />
                </div>
            )}
            
            <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">E-mail</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="exemplo@email.com"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Senha</label>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                        placeholder="••••••••"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        title={showPassword ? "Ocultar senha" : "Ver senha"}
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Remember Me Checkbox */}
            {!isRegistering && (
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors select-none">Lembrar de mim</span>
                    </label>
                    <button type="button" className="text-sm text-blue-600 hover:underline">Esqueceu a senha?</button>
                </div>
            )}

            <button 
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait"
            >
                {loading ? 'Processando...' : (isRegistering ? 'Criar Conta' : 'Entrar')}
            </button>
        </form>

        <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase">Ou continue com</span>
            <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <button 
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm group"
        >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm">Google</span>
        </button>

        <div className="mt-6 text-center text-sm">
            <span className="text-slate-600">{isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}</span>
            <button 
                onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError(null);
                }}
                className="ml-2 font-bold text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
            >
                {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;