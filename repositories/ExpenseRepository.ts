// /repositories/ExpenseRepository.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '../models/Expense';

const EXPENSES_KEY = 'expenses';

export const saveExpense = async (expense: Expense) => {
    const existing = await AsyncStorage.getItem(EXPENSES_KEY);
    const expenses = existing ? JSON.parse(existing) : [];
    expenses.push(expense);
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
};

export const getAllExpenses = async (): Promise<Expense[]> => {
    const data = await AsyncStorage.getItem(EXPENSES_KEY);
    return data ? JSON.parse(data) : [];
};
