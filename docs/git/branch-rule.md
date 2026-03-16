## Git Branch 작성 규칙

### 작성 형식

브랜치 이름은 다음 형식을 따릅니다.

타입/작업단위

* 공백은 사용하지 않습니다.
* 단어 구분은 `-` 만 사용합니다.

예시

* feature/login-system
* fix/login-error
* refactor/user-service

### 타입 의미

* **feature** : 새로운 기능 개발
* **fix** : 버그 수정
* **hotfix** : 긴급 수정
* **refactor** : 코드 구조 개선

### 알아야 할 규칙

`feature/anything` 브랜치를 `main` 브랜치에 병합한 이후 수정 사항이 발생한 경우
기존 `feature` 브랜치를 계속 사용하는 것이 아니라 새로운 `fix/anything` 브랜치를 생성하여 작업합니다.

이를 통해 기능 개발 브랜치와 버그 수정 브랜치를 명확하게 구분할 수 있습니다.
