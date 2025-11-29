import { User, Destination } from '../types';

const USERS_KEY = 'rotaai_users';
const DATA_PREFIX = 'rotaai_data_';

// Helper to delay execution (simulate network)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  // --- Auth Methods ---

  async register(name: string, email: string, password: string): Promise<User> {
    await delay(800); // Simulate API call
    
    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];

    if (users.some(u => u.email === email)) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email,
      password, // Note: Not secure for production, fine for local demo
      picture: '' // No picture for custom auth
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    return newUser;
  },

  async login(email: string, password: string): Promise<User> {
    await delay(800); // Simulate API call

    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];

    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      throw new Error("E-mail ou senha inválidos.");
    }

    return user;
  },

  // --- Data Persistence Methods ---

  saveUserData(userId: string, destinations: Destination[]) {
    localStorage.setItem(`${DATA_PREFIX}${userId}`, JSON.stringify(destinations));
  },

  loadUserData(userId: string): Destination[] {
    const data = localStorage.getItem(`${DATA_PREFIX}${userId}`);
    return data ? JSON.parse(data) : [];
  }
};