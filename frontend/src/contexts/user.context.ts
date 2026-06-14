import { createContext } from 'react';

export interface UserProfile {
  id: number;
  name: string;
  gender: string;
  birth_date: string;
  height: number;
  current_weight: number;
  target_weight: number;
  activity_level: string;
  goal_calories: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fat: number;
  last_weight_update: string;
  equipment: any[];
}

export interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);
