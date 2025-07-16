// 사용자 이름 가져오기 헬퍼 함수
function getUserName(user) {
    if (!user) return '익명의 사용자';
    
    // 1순위: first_name + last_name
    if (user.first_name) {
        const fullName = user.last_name ? 
            `${user.first_name} ${user.last_name}` : 
            user.first_name;
        return fullName;
    }
    
    // 2순위: username
    if (user.username) {
        return `@${user.username}`;
    }
    
    // 3순위: 사용자 ID
    if (user.id) {
        return `사용자${user.id}`;
    }
    
    return '익명의 사용자';
}

// 사용자 정보 포맷팅 (더 자세한 정보)
function formatUserInfo(user) {
    if (!user) return '익명의 사용자';
    
    let info = '';
    
    // 이름 부분
    if (user.first_name) {
        info += user.first_name;
        if (user.last_name) {
            info += ` ${user.last_name}`;
        }
    }
    
    // 사용자명 추가
    if (user.username) {
        info += info ? ` (@${user.username})` : `@${user.username}`;
    }
    
    // 이름도 사용자명도 없으면 ID 사용
    if (!info && user.id) {
        info = `사용자${user.id}`;
    }
    
    return info || '익명의 사용자';
}

module.exports = {
    getUserName,
    formatUserInfo
};
