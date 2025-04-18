import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import DatePicker from 'react-native-modern-datepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNPickerSelect from 'react-native-picker-select';
import { FlatList } from 'react-native';

// Utility function to convert Persian numerals to Western numerals
const persianToWesternNumerals = (text: string) => {
    const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const westernNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let result = text;
    persianNumerals.forEach((num, index) => {
        result = result.replace(new RegExp(num, 'g'), westernNumerals[index]);
    });
    return result;
};

// Utility function to convert Gregorian to Jalali date
const gregorianToJalali = (gregorianDate: string) => {
    const [year, month, day] = gregorianDate.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    let gy = date.getFullYear();
    let gm = date.getMonth() + 1;
    let gd = date.getDate();

    let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    let gy2 = gm > 2 ? gy + 1 : gy;
    let days =
        365 * gy +
        Math.floor((gy2 + 3) / 4) -
        Math.floor((gy2 + 99) / 100) +
        Math.floor((gy2 + 399) / 400) -
        80 +
        gd +
        (gm > 2 ? g_d_m[gm - 1] + 1 : g_d_m[gm - 1]);
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
        jy += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }
    let jm =
        days < 186
            ? 1 + Math.floor(days / 31)
            : 7 + Math.floor((days - 186) / 30);
    let jd = days < 186 ? 1 + (days % 31) : 1 + ((days - 186) % 30);

    return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
};

export default function ExpensesScreen() {
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [filteredExpenses, setFilteredExpenses] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [amountError, setAmountError] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [showFilterStartDatePicker, setShowFilterStartDatePicker] = useState(false);
    const [showFilterEndDatePicker, setShowFilterEndDatePicker] = useState(false);
    const [filterType, setFilterType] = useState('dateRange'); // 'dateRange' or 'monthYear'
    const [categories, setCategories] = useState([
        { label: 'غذا', value: 'food' },
        { label: 'حمل و نقل', value: 'transport' },
        { label: 'سرگرمی', value: 'entertainment' },
        { label: 'صورتحساب', value: 'bills' },
    ]);

    // Load expenses and categories from AsyncStorage
    React.useEffect(() => {
        const loadData = async () => {
            try {
                const storedExpenses = await AsyncStorage.getItem('expenses');
                if (storedExpenses) {
                    const parsedExpenses = JSON.parse(storedExpenses);
                    const validExpenses = parsedExpenses.filter(
                        (expense) => expense.amount && !isNaN(expense.amount)
                    );
                    setExpenses(validExpenses);
                    setFilteredExpenses(validExpenses);
                }
                const storedCategories = await AsyncStorage.getItem('categories');
                if (storedCategories) {
                    setCategories(JSON.parse(storedCategories));
                }
            } catch (error) {
                console.error('Failed to load data', error);
            }
        };
        loadData();
    }, []);

    // Filter expenses based on selected criteria
    const filterExpenses = () => {
        let filtered = expenses;

        // Filter by date range
        if (filterType === 'dateRange' && filterStartDate && filterEndDate) {
            filtered = filtered.filter((expense) => {
                const expenseDate = new Date(expense.date);
                const startDate = new Date(filterStartDate);
                const endDate = new Date(filterEndDate);
                return expenseDate >= startDate && expenseDate <= endDate;
            });
        }

        // Filter by month and year (convert Gregorian to Jalali for comparison)
        if (filterType === 'monthYear' && filterMonth && filterYear) {
            filtered = filtered.filter((expense) => {
                const jalaliDate = gregorianToJalali(expense.date);
                const [year, month] = jalaliDate.split('/').map(Number);
                return year === parseInt(filterYear) && month === parseInt(filterMonth);
            });
        }

        // Filter by category
        if (filterCategory) {
            filtered = filtered.filter((expense) => expense.category === filterCategory);
        }

        setFilteredExpenses(filtered);
    };

    // Calculate total amount of filtered expenses
    const calculateTotal = () => {
        return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    };

    // Format number with thousands separator
    const formatNumber = (value: string) => {
        if (!value) return '';
        const cleanValue = persianToWesternNumerals(value.replace(/[^۰-۹0-9]/g, ''));
        const parsedValue = parseFloat(cleanValue);
        if (isNaN(parsedValue)) return value;
        return parsedValue.toLocaleString('fa-IR', { minimumFractionDigits: 0 });
    };

    // Handle amount input change
    const handleAmountChange = (text: string) => {
        setExpenseAmount(text);
        setErrorMessage('');
        setAmountError(false);
    };

    // Format amount on blur
    const handleAmountBlur = () => {
        const formatted = formatNumber(expenseAmount);
        setExpenseAmount(formatted);
    };

    const handleConfirmDate = (selectedDate: string) => {
        setDate(selectedDate);
        setShowDatePicker(false);
        setErrorMessage('');
    };

    // Add new category
    const handleAddCategory = async () => {
        if (!newCategory.trim()) {
            setErrorMessage('لطفاً نام دسته‌بندی را وارد کنید');
            return;
        }
        const categoryValue = newCategory.toLowerCase().replace(/\s+/g, '_');
        const newCategoryObj = { label: newCategory.trim(), value: categoryValue };
        const updatedCategories = [...categories, newCategoryObj];
        try {
            await AsyncStorage.setItem('categories', JSON.stringify(updatedCategories));
            setCategories(updatedCategories);
            setNewCategory('');
            setErrorMessage('');
        } catch (error) {
            console.error('Failed to save category', error);
            setErrorMessage('خطا در ذخیره دسته‌بندی');
        }
    };

    // Save or update expense
    const handleSaveExpense = async () => {
        if (!expenseAmount || !category || !date) {
            setErrorMessage('لطفاً تمام فیلدهای ضروری را پر کنید');
            return;
        }

        const cleanAmount = persianToWesternNumerals(expenseAmount.replace(/[^۰-۹0-9]/g, ''));
        const parsedAmount = parseFloat(cleanAmount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setErrorMessage('لطفاً یک مبلغ معتبر وارد کنید');
            setAmountError(true);
            return;
        }

        const expense = {
            id: editingExpenseId || Date.now().toString(),
            amount: parsedAmount,
            description: expenseDescription,
            category,
            date,
        };

        try {
            let updatedExpenses;
            if (editingExpenseId) {
                updatedExpenses = expenses.map((exp) =>
                    exp.id === editingExpenseId ? expense : exp
                );
                setEditingExpenseId(null);
            } else {
                updatedExpenses = [expense, ...expenses];
            }
            await AsyncStorage.setItem('expenses', JSON.stringify(updatedExpenses));
            setExpenses(updatedExpenses);
            setFilteredExpenses(updatedExpenses); // Update filtered list after saving
            setExpenseAmount('');
            setExpenseDescription('');
            setCategory('');
            setDate('');
            setErrorMessage('');
            setAmountError(false);
        } catch (error) {
            console.error('Failed to save expense', error);
            setErrorMessage('خطا در ذخیره هزینه');
        }
    };

    // Delete expense
    const handleDeleteExpense = async (id: string) => {
        try {
            const updatedExpenses = expenses.filter((expense) => expense.id !== id);
            await AsyncStorage.setItem('expenses', JSON.stringify(updatedExpenses));
            setExpenses(updatedExpenses);
            setFilteredExpenses(updatedExpenses); // Update filtered list after deletion
        } catch (error) {
            console.error('Failed to delete expense', error);
            setErrorMessage('خطا در حذف هزینه');
        }
    };

    // Edit expense
    const handleEditExpense = (expense: any) => {
        setEditingExpenseId(expense.id);
        setExpenseAmount(formatNumber(expense.amount.toString()));
        setExpenseDescription(expense.description || '');
        setCategory(expense.category);
        setDate(expense.date);
        setErrorMessage('');
        setAmountError(false);
    };

    // Render each expense item
    const renderExpenseItem = ({ item }) => {
        const categoryLabel = categories.find((cat) => cat.value === item.category)?.label || item.category;
        const jalaliDate = gregorianToJalali(item.date);
        return (
            <View style={styles.expenseItem}>
                <View style={styles.expenseInfo}>
                    <Text style={styles.expenseText}>
                        {categoryLabel} | {item.amount.toLocaleString('fa-IR')} تومان | {item.description || 'نامشخص'} | {jalaliDate}
                    </Text>
                </View>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => handleEditExpense(item)}
                    >
                        <Text style={styles.actionButtonText}>ویرایش</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteExpense(item.id)}
                    >
                        <Text style={styles.actionButtonText}>حذف</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Add Expense Section */}
            <View style={styles.sectionCard}>
                <Text style={styles.title}>افزودن هزینه جدید</Text>

                <Text style={styles.label}>دسته‌بندی</Text>
                <RNPickerSelect
                    onValueChange={(value) => {
                        setCategory(value);
                        setErrorMessage('');
                    }}
                    items={categories}
                    style={pickerStyles}
                    placeholder={{
                        label: 'انتخاب دسته‌بندی...',
                        value: null,
                        color: '#888',
                    }}
                    value={category}
                />

                <Text style={styles.label}>مبلغ (تومان)</Text>
                <TextInput
                    style={[styles.input, amountError && styles.inputError]}
                    placeholder="مبلغ را وارد کنید"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    value={expenseAmount}
                    onChangeText={handleAmountChange}
                    onBlur={handleAmountBlur}
                />

                <Text style={styles.label}>توضیحات</Text>
                <TextInput
                    style={styles.input}
                    placeholder="توضیحات را وارد کنید"
                    placeholderTextColor="#888"
                    value={expenseDescription}
                    onChangeText={(text) => {
                        setExpenseDescription(text);
                        setErrorMessage('');
                    }}
                />

                <Text style={styles.label}>تاریخ</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
                    <Text style={[styles.dateText, { color: date ? '#fff' : '#888' }]}>
                        {date || 'انتخاب تاریخ'}
                    </Text>
                </TouchableOpacity>

                <Modal isVisible={showDatePicker} onBackdropPress={() => setShowDatePicker(false)}>
                    <View style={styles.modalContent}>
                        <DatePicker
                            mode="calendar"
                            onSelectedChange={handleConfirmDate}
                            options={{
                                backgroundColor: '#1e1e1e',
                                textHeaderColor: '#0af',
                                textDefaultColor: '#fff',
                                selectedTextColor: '#fff',
                                mainColor: '#0af',
                                borderColor: '#333',
                            }}
                            locale="fa"
                        />
                    </View>
                </Modal>

                <Text style={styles.label}>دسته‌بندی جدید</Text>
                <View style={styles.categoryInputContainer}>
                    <TextInput
                        style={[styles.input, styles.categoryInput]}
                        placeholder="نام دسته‌بندی جدید"
                        placeholderTextColor="#888"
                        value={newCategory}
                        onChangeText={setNewCategory}
                    />
                    <TouchableOpacity style={styles.addCategoryButton} onPress={handleAddCategory}>
                        <Text style={styles.buttonText}>افزودن</Text>
                    </TouchableOpacity>
                </View>

                {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                ) : null}

                <TouchableOpacity style={styles.primaryButton} onPress={handleSaveExpense}>
                    <Text style={styles.buttonText}>
                        {editingExpenseId ? 'به‌روزرسانی هزینه' : 'ذخیره هزینه'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Filter and Expenses Section */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>لیست هزینه‌ها</Text>

                {/* Filter Section */}
                <View style={styles.filterContainer}>
                    <Text style={styles.sectionTitle}>فیلتر هزینه‌ها</Text>

                    {/* Filter Type Selector */}
                    <View style={styles.filterTypeContainer}>
                        <TouchableOpacity
                            style={[
                                styles.filterTypeButton,
                                filterType === 'dateRange' && styles.filterTypeButtonActive,
                            ]}
                            onPress={() => setFilterType('dateRange')}
                        >
                            <Text style={styles.filterTypeText}>بازه زمانی</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.filterTypeButton,
                                filterType === 'monthYear' && styles.filterTypeButtonActive,
                            ]}
                            onPress={() => setFilterType('monthYear')}
                        >
                            <Text style={styles.filterTypeText}>ماه و سال</Text>
                        </TouchableOpacity>
                    </View>

                    {filterType === 'dateRange' ? (
                        <>
                            <Text style={styles.label}>از تاریخ</Text>
                            <TouchableOpacity
                                onPress={() => setShowFilterStartDatePicker(true)}
                                style={styles.dateInput}
                            >
                                <Text style={[styles.dateText, { color: filterStartDate ? '#fff' : '#888' }]}>
                                    {filterStartDate || 'انتخاب تاریخ شروع'}
                                </Text>
                            </TouchableOpacity>
                            <Modal
                                isVisible={showFilterStartDatePicker}
                                onBackdropPress={() => setShowFilterStartDatePicker(false)}
                            >
                                <View style={styles.modalContent}>
                                    <DatePicker
                                        mode="calendar"
                                        onSelectedChange={(date) => {
                                            setFilterStartDate(date);
                                            setShowFilterStartDatePicker(false);
                                        }}
                                        options={{
                                            backgroundColor: '#1e1e1e',
                                            textHeaderColor: '#0af',
                                            textDefaultColor: '#fff',
                                            selectedTextColor: '#fff',
                                            mainColor: '#0af',
                                            borderColor: '#333',
                                        }}
                                        locale="fa"
                                    />
                                </View>
                            </Modal>

                            <Text style={styles.label}>تا تاریخ</Text>
                            <TouchableOpacity
                                onPress={() => setShowFilterEndDatePicker(true)}
                                style={styles.dateInput}
                            >
                                <Text style={[styles.dateText, { color: filterEndDate ? '#fff' : '#888' }]}>
                                    {filterEndDate || 'انتخاب تاریخ پایان'}
                                </Text>
                            </TouchableOpacity>
                            <Modal
                                isVisible={showFilterEndDatePicker}
                                onBackdropPress={() => setShowFilterEndDatePicker(false)}
                            >
                                <View style={styles.modalContent}>
                                    <DatePicker
                                        mode="calendar"
                                        onSelectedChange={(date) => {
                                            setFilterEndDate(date);
                                            setShowFilterEndDatePicker(false);
                                        }}
                                        options={{
                                            backgroundColor: '#1e1e1e',
                                            textHeaderColor: '#0af',
                                            textDefaultColor: '#fff',
                                            selectedTextColor: '#fff',
                                            mainColor: '#0af',
                                            borderColor: '#333',
                                        }}
                                        locale="fa"
                                    />
                                </View>
                            </Modal>
                        </>
                    ) : (
                        <>
                            <Text style={styles.label}>ماه</Text>
                            <RNPickerSelect
                                onValueChange={(value) => setFilterMonth(value)}
                                items={[
                                    { label: 'فروردین', value: '1' },
                                    { label: 'اردیبهشت', value: '2' },
                                    { label: 'خرداد', value: '3' },
                                    { label: 'تیر', value: '4' },
                                    { label: 'مرداد', value: '5' },
                                    { label: 'شهریور', value: '6' },
                                    { label: 'مهر', value: '7' },
                                    { label: 'آبان', value: '8' },
                                    { label: 'آذر', value: '9' },
                                    { label: 'دی', value: '10' },
                                    { label: 'بهمن', value: '11' },
                                    { label: 'اسفند', value: '12' },
                                ]}
                                style={pickerStyles}
                                placeholder={{
                                    label: 'انتخاب ماه...',
                                    value: '',
                                    color: '#888',
                                }}
                                value={filterMonth}
                            />

                            <Text style={styles.label}>سال</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="سال (مثال: 1403)"
                                placeholderTextColor="#888"
                                keyboardType="numeric"
                                value={filterYear}
                                onChangeText={(text) => setFilterYear(persianToWesternNumerals(text))}
                            />
                        </>
                    )}

                    {/* Category Filter */}
                    <Text style={styles.label}>دسته‌بندی</Text>
                    <RNPickerSelect
                        onValueChange={(value) => setFilterCategory(value)}
                        items={categories}
                        style={pickerStyles}
                        placeholder={{
                            label: 'انتخاب دسته‌بندی...',
                            value: '',
                            color: '#888',
                        }}
                        value={filterCategory}
                    />
                </View>

                {/* Total Expenses */}
                <View style={styles.totalContainer}>
                    <Text style={styles.totalText}>
                        مجموع هزینه‌ها: {calculateTotal().toLocaleString('fa-IR')} تومان
                    </Text>
                </View>

                {/* Expenses List */}
                <FlatList
                    data={filteredExpenses}
                    renderItem={renderExpenseItem}
                    keyExtractor={(item) => item.id}
                    style={styles.expensesList}
                />
            </View>

            {/* Sticky Filter Buttons */}
            <View style={styles.stickyButtonContainer}>
                <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1, marginRight: 8 }]}
                    onPress={filterExpenses}
                >
                    <Text style={styles.buttonText}>اعمال فیلتر</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1, backgroundColor: '#f00' }]}
                    onPress={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setFilterMonth('');
                        setFilterYear('');
                        setFilterCategory('');
                        setFilteredExpenses(expenses);
                    }}
                >
                    <Text style={styles.buttonText}>پاک کردن فیلتر</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const pickerStyles = {
    inputAndroid: {
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
        textAlign: 'right',
        height: 48,
    },
    inputIOS: {
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
        textAlign: 'right',
        height: 48,
    },
    placeholder: {
        color: '#888',
        fontSize: 16,
    },
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#121212',
        padding: 20,
    },
    sectionCard: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 24,
        textAlign: 'right',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'right',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#ccc',
        marginBottom: 8,
        textAlign: 'right',
    },
    input: {
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
        textAlign: 'right',
        height: 48,
        marginBottom: 16,
    },
    inputError: {
        borderColor: '#f00',
        borderWidth: 1,
    },
    dateInput: {
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        padding: 12,
        height: 48,
        justifyContent: 'center',
        marginBottom: 16,
    },
    dateText: {
        fontSize: 16,
        textAlign: 'right',
    },
    modalContent: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 16,
    },
    categoryInputContainer: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        marginBottom: 16,
    },
    categoryInput: {
        flex: 1,
        marginRight: 12,
    },
    addCategoryButton: {
        backgroundColor: '#0af',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#0af',
        borderRadius: 8,
    //    .Concurrent: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: '#f00',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'right',
    },
    filterContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
    },
    filterTypeContainer: {
        flexDirection: 'row-reverse',
        marginBottom: 16,
    },
    filterTypeButton: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    filterTypeButtonActive: {
        backgroundColor: '#0af',
    },
    filterTypeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    totalContainer: {
        marginTop: 16,
        marginBottom: 16,
    },
    totalText: {
        color: '#0af',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'right',
    },
    expensesList: {
        marginTop: 8,
    },
    expenseItem: {
        flexDirection: 'row-reverse',
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    expenseInfo: {
        flex: 1,
    },
    expenseText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'right',
    },
    buttonContainer: {
        flexDirection: 'row-reverse',
        marginLeft: 12,
    },
    actionButton: {
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginLeft: 8,
    },
    editButton: {
        backgroundColor: '#0af',
    },
    deleteButton: {
        backgroundColor: '#f00',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    stickyButtonContainer: {
        flexDirection: 'row-reverse',
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
});