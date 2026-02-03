import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

export default function FindIdScreen({ navigation }) {
    const { t } = useTranslation('auth');
    const [searchType, setSearchType] = useState("displayName"); // 'displayName' or 'name'
    const [searchValue, setSearchValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const { findId } = useAuth();

    const handleFindId = async () => {
        if (!searchValue.trim()) {
            Alert.alert(t('common:notice'), searchType === 'displayName' ? t('enterNickname') : t('enterName'));
            return;
        }

        setLoading(true);
        setResult(null);
        const response = await findId(searchType, searchValue);
        setLoading(false);

        if (response.success) {
            setResult(response.emails);
        } else {
            Alert.alert(t('common:notice'), response.error);
        }
    };

    const maskEmail = (email) => {
        const [localPart, domain] = email.split("@");
        if (localPart.length <= 2) {
            return `${localPart}***@${domain}`;
        }
        return `${localPart.slice(0, 2)}***@${domain}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('findIdTitle')}</Text>
            </View>

            <View style={styles.content}>
                {/* 탭 선택 */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, searchType === "displayName" && styles.activeTab]}
                        onPress={() => {
                            setSearchType("displayName");
                            setSearchValue("");
                            setResult(null);
                        }}
                    >
                        <Text style={[styles.tabText, searchType === "displayName" && styles.activeTabText]}>{t('findByNickname')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, searchType === "name" && styles.activeTab]}
                        onPress={() => {
                            setSearchType("name");
                            setSearchValue("");
                            setResult(null);
                        }}
                    >
                        <Text style={[styles.tabText, searchType === "name" && styles.activeTabText]}>{t('findByName')}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.description}>
                    {searchType === "displayName"
                        ? t('nicknameDescription')
                        : t('nameDescription')}
                </Text>

                <View style={styles.inputGroup}>
                    <Ionicons name={searchType === "displayName" ? "person-outline" : "id-card-outline"} size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder={searchType === "displayName" ? t('nickname') : t('name')}
                        value={searchValue}
                        onChangeText={setSearchValue}
                        autoCapitalize="none"
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleFindId}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{t('findIdTitle')}</Text>
                    )}
                </TouchableOpacity>

                {result && (
                    <View style={styles.resultContainer}>
                        <Text style={styles.resultTitle}>{t('foundIds')}</Text>
                        {result.map((email, index) => (
                            <Text key={index} style={styles.resultText}>
                                {maskEmail(email)}
                            </Text>
                        ))}
                        <TouchableOpacity
                            style={styles.loginLinkButton}
                            onPress={() => navigation.navigate("로그인")}
                        >
                            <Text style={styles.loginLinkText}>{t('goToLogin')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginLeft: 8,
    },
    content: {
        padding: 24,
    },
    tabContainer: {
        flexDirection: "row",
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: "#FF6B35",
    },
    tabText: {
        fontSize: 15,
        color: "#999",
    },
    activeTabText: {
        color: "#FF6B35",
        fontWeight: "bold",
    },
    description: {
        fontSize: 14,
        color: "#666",
        marginBottom: 24,
    },
    inputGroup: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: "#333",
    },
    button: {
        backgroundColor: "#FF6B35",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    resultContainer: {
        marginTop: 32,
        padding: 16,
        backgroundColor: "#FFF0EB",
        borderRadius: 8,
        alignItems: "center",
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 12,
    },
    resultText: {
        fontSize: 18,
        color: "#FF6B35",
        fontWeight: "bold",
        marginBottom: 8,
    },
    loginLinkButton: {
        marginTop: 16,
    },
    loginLinkText: {
        color: "#666",
        textDecorationLine: "underline",
    },
});
