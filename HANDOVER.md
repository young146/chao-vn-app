# Android 빌드 에러 핸드오버

**날짜**: 2026-03-17  
**상태**: ✅ 해결 완료

---

## 에러 내용

```
A problem occurred configuring project ':expo-modules-core'.
java.io.IOException: 파일 이름, 디렉터리 이름 또는 볼륨 레이블 구문이 잘못되었습니다
```

## 근본 원인

**`ANDROID_HOME` 환경변수 값 앞에 공백이 있었음.**

```
# 잘못된 값 (앞에 공백)
ANDROID_HOME= C:\Users\XINCHAO\AppData\Local\Android\Sdk

# 올바른 값
ANDROID_HOME=C:\Users\XINCHAO\AppData\Local\Android\Sdk
```

AGP의 `SdkLocator.validateSdkPath()`가 이 경로를 검증할 때 앞 공백 때문에 `java.io.IOException` 발생.

## 수정 방법

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\XINCHAO\AppData\Local\Android\Sdk", "User")
```

## 불필요했던 시도들 (삭제 가능)

- `gradle.properties`에 `android.enableProfileJson=false` 추가 → 효과 없음
- `org.gradle.jvmargs`에 `-Djava.io.tmpdir=C:/tmp` 추가 → 효과 없음
- `GRADLE_OPTS` 환경변수로 tmpdir 전달 → 효과 없음
- Gradle init script로 AGP analytics 비활성화 → 효과 없음

> `gradle.properties`는 원본 상태로 복구됨 (기존 임시 설정 유지)
