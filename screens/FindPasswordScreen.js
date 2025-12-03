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
import { useAuth } from "../contexts/AuthContext";

export default function FindPasswordScreen({ navigation }) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const { findPassword } = useAuth();

    const handleFindPassword = async () => {
        if (!email.trim()) {
            Alert.alert("알림", "이메일을 입력해주세요.");
            return;
        }

        setLoading(true);
        const result = await findPassword(email);
        setLoading(false);

        if (result.success) {
            Alert.alert(
                "메일 발송 완료",
                "비밀번호 재설정 메일을 보냈습니다.\n메일함을 확인해주세요.",
                [
                    {
                        text: "확인",
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } else {
            Alert.alert("실패", result.error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>비밀번호 찾기</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.description}>
                    가입하신 이메일 주소를 입력하시면{"\n"}비밀번호 재설정 메일을 보내드립니다.
                </Text>

                <View style={styles.inputGroup}>
                    <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="이메일"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleFindPassword}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>비밀번호 재설정 메일 보내기</Text>
                    )}
                </TouchableOpacity>
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
    description: {
        fontSize: 14,
        color: "#666",
        marginBottom: 24,
        lineHeight: 20,
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
});
