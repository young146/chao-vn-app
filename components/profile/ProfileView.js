import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

export default function ProfileView({
    user,
    profileImage,
    uploading,
    name,
    email,
    isAdmin,
    stats,
    city,
    district,
    apartment,
    detailedAddress,
    postalCode,
    residencePeriod,
    residencePurpose,
    occupation,
    kakaoId,
    zaloId,
    facebook,
    instagram,
    onPickImage,
    onEdit,
    onAppSettings,
    onHelp,
    onAppInfo,
}) {
    const { t } = useTranslation('profile');
    return (
        <ScrollView style={styles.container}>
            <View style={styles.profileHeader}>
                <TouchableOpacity onPress={onPickImage} style={styles.avatarContainer}>
                    {uploading ? (
                        <View style={styles.avatar}>
                            <ActivityIndicator size="large" color="#fff" />
                        </View>
                    ) : profileImage ? (
                        <Image
                            source={{ uri: profileImage }}
                            style={styles.avatarImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={40} color="#fff" />
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                </TouchableOpacity>

                <View style={styles.usernameContainer}>
                    <Text style={styles.username}>{name || "User"}</Text>
                    {isAdmin() && (
                        <View style={styles.adminBadge}>
                            <Ionicons name="shield-checkmark" size={14} color="#fff" />
                            <Text style={styles.adminBadgeText}>ADMIN</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.email}>{email}</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.bookmarks}</Text>
                    <Text style={styles.statLabel}>{t('bookmarks')}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.comments}</Text>
                    <Text style={styles.statLabel}>{t('comments')}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.editButtonText}>{t('editProfile')}</Text>
            </TouchableOpacity>

            {/* 프로필 정보 표시 */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="person-outline" size={20} color="#FF6B35" />
                    <Text style={styles.sectionTitle}>{t('basicInfo')}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('email')}</Text>
                    <Text style={styles.infoValue}>{email || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('name')}</Text>
                    <Text style={styles.infoValue}>{name || "-"}</Text>
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="location" size={20} color="#FF6B35" />
                    <Text style={styles.sectionTitle}>{t('address')}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('city')}</Text>
                    <Text style={styles.infoValue}>{city || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('district')}</Text>
                    <Text style={styles.infoValue}>{district || "-"}</Text>
                </View>
                {apartment && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('apartment')}</Text>
                        <Text style={styles.infoValue}>{apartment}</Text>
                    </View>
                )}
                {detailedAddress && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('detailedAddress')}</Text>
                        <Text style={styles.infoValue}>{detailedAddress}</Text>
                    </View>
                )}
                {postalCode && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('postalCode')}</Text>
                        <Text style={styles.infoValue}>{postalCode}</Text>
                    </View>
                )}
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="briefcase-outline" size={20} color="#FF6B35" />
                    <Text style={styles.sectionTitle}>{t('residenceJob')}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('residencePeriod')}</Text>
                    <Text style={styles.infoValue}>{residencePeriod || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('residencePurpose')}</Text>
                    <Text style={styles.infoValue}>{residencePurpose || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('occupation')}</Text>
                    <Text style={styles.infoValue}>{occupation || "-"}</Text>
                </View>
            </View>

            {(kakaoId || zaloId || facebook || instagram) && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="share-social-outline" size={20} color="#FF6B35" />
                        <Text style={styles.sectionTitle}>{t('snsInfo')}</Text>
                    </View>
                    {kakaoId && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t('kakaoId')}</Text>
                            <Text style={styles.infoValue}>{kakaoId}</Text>
                        </View>
                    )}
                    {zaloId && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t('zaloId')}</Text>
                            <Text style={styles.infoValue}>{zaloId}</Text>
                        </View>
                    )}
                    {facebook && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t('facebook')}</Text>
                            <Text style={styles.infoValue}>{facebook}</Text>
                        </View>
                    )}
                    {instagram && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t('instagram')}</Text>
                            <Text style={styles.infoValue}>{instagram}</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.section}>
                <TouchableOpacity style={styles.menuItem} onPress={onAppSettings}>
                    <Ionicons name="settings-outline" size={20} color="#666" />
                    <Text style={styles.menuText}>{t('appSettings')}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={onHelp}>
                    <Ionicons name="help-circle-outline" size={20} color="#666" />
                    <Text style={styles.menuText}>{t('help')}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={onAppInfo}>
                    <Ionicons
                        name="information-circle-outline"
                        size={20}
                        color="#666"
                    />
                    <Text style={styles.menuText}>{t('appInfo')}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
            </View>

            <View style={styles.versionContainer}>
                <Text style={styles.versionText}>{t('appVersion')}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    profileHeader: {
        alignItems: "center",
        padding: 24,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    avatarContainer: {
        position: "relative",
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#ddd",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    cameraIcon: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "#FF6B35",
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    usernameContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    username: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        marginRight: 8,
    },
    adminBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FF6B35",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    adminBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "bold",
        marginLeft: 4,
    },
    email: {
        fontSize: 14,
        color: "#666",
    },
    statsContainer: {
        flexDirection: "row",
        backgroundColor: "#fff",
        paddingVertical: 16,
        marginTop: 12,
        marginHorizontal: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statItem: {
        flex: 1,
        alignItems: "center",
    },
    statNumber: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
    },
    divider: {
        width: 1,
        backgroundColor: "#eee",
    },
    editButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FF6B35",
        margin: 16,
        padding: 14,
        borderRadius: 8,
    },
    editButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
        marginLeft: 8,
    },
    section: {
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
        paddingBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginLeft: 8,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: "#666",
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: "#333",
        fontWeight: "500",
        flex: 2,
        textAlign: "right",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        color: "#333",
        marginLeft: 12,
    },
    versionContainer: {
        alignItems: "center",
        paddingBottom: 32,
    },
    versionText: {
        fontSize: 12,
        color: "#999",
    },
});
