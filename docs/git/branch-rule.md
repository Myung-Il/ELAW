## Git Branch 작성 규칙

### 작성 형식

브랜치 이름은 다음 형식을 따릅니다.

타입/역할/작업단위

* 공백은 사용하지 않습니다.
* 단어 구분은 `-` 만 사용합니다.

예시

* feature/backend/login-api
* feature/frontend/login-page
* feature/database/user-table
* docs/etc/git-convention

### 타입 의미

* **feature** : 새로운 기능 개발
* **fix** : 버그 수정
* **hotfix** : 긴급 수정
* **refactor** : 코드 구조 개선

### 역할 의미

* **backend** : 서버 및 API 개발
* **frontend** : 사용자 인터페이스 개발
* **database** : 데이터베이스 설계 및 관리
* **test** : 테스트 코드 작성
* **etc** : 기타 작업

### 알아야 할 규칙

* 하나의 브랜치는 하나의 작업만을 수행하도록 생성합니다.
* `feature/roll/anything` 브랜치를 `main` 브랜치에 병합한 이후 수정 사항이 발생한 경우,
  기존 `feature` 브랜치를 계속 사용하는 것이 아니라 새로운 `fix/roll/anything` 브랜치를 생성하여 작업합니다.

이를 통해 작업 단위와 역할을 명확하게 구분할 수 있습니다.
