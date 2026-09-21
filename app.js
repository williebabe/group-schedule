const firebaseConfig = {
  apiKey: "AIzaSyBmPL1duKzVgOWhx0yEUqPjs24kYMPOCDI",
  authDomain: "group-projecttu100.firebaseapp.com",
  projectId: "group-projecttu100",
  storageBucket: "group-projecttu100.firebasestorage.app",
  messagingSenderId: "455163982100",
  appId: "1:455163982100:web:b8b03c6d624e4a364d9201",
  measurementId: "G-CGQJFCCLKT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let selectedDatesArray = [];

// 1. เรียกใช้งาน Flatpickr (เลือกได้หลายวัน)
flatpickr("#date-select", {
  mode: "multiple",
  dateFormat: "Y-m-d",
  defaultDate: ["today"],
  onChange: function(selectedDates) {
    selectedDatesArray = selectedDates.map(date => date.toLocaleDateString('en-CA'));
  }
});

// กำหนดค่าเริ่มต้นวันปัจจุบัน
selectedDatesArray = [new Date().toLocaleDateString('en-CA')];

function toggleReasonInput() {
  const status = document.getElementById('status').value;
  document.getElementById('reason-group').style.display = status === 'available' ? 'none' : 'block';
}

// 2. ดึงข้อมูล Real-time รวมทั้งหมด และแสดงผลในตาราง
db.ref('members').on('value', (snapshot) => {
  const allData = snapshot.val();
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';

  if (!allData) {
    document.getElementById('count-available').innerText = '0';
    document.getElementById('count-online').innerText = '0';
    document.getElementById('count-busy').innerText = '0';
    document.getElementById('common-status').innerText = 'ยังไม่มีข้อมูลการลงชื่อ';
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">ยังไม่มีข้อมูลการลงชื่อ</td></tr>`;
    return;
  }

  // จัดหมวดหมู่ข้อมูลแยกตามชื่อคน
  const userMap = {};

  Object.keys(allData).forEach(dateStr => {
    const dayMembers = allData[dateStr];
    Object.keys(dayMembers).forEach(name => {
      const rec = dayMembers[name];

      if (!userMap[name]) userMap[name] = [];
      userMap[name].push({
        date: dateStr,
        status: rec.status,
        reason: rec.reason
      });
    });
  });

  // คำนวณนับรายหัวคน (Unique Members Count)
  let countAvailablePeople = 0;
  let countOnlinePeople = 0;
  let countBusyPeople = 0;

  Object.keys(userMap).forEach(name => {
    const userRecords = userMap[name];
    
    const hasAvailable = userRecords.some(r => r.status === 'available');
    const hasOnline = userRecords.some(r => r.status === 'busy-online');

    if (hasAvailable) {
      countAvailablePeople++;
    } else if (hasOnline) {
      countOnlinePeople++;
    } else {
      countBusyPeople++;
    }
  });

  // อัปเดตการ์ด Dashboard สรุปจำนวนคน
  document.getElementById('count-available').innerText = countAvailablePeople;
  document.getElementById('count-online').innerText = countOnlinePeople;
  document.getElementById('count-busy').innerText = countBusyPeople;

  const totalPeople = Object.keys(userMap).length;
  const banner = document.getElementById('common-status');
  banner.innerText = `มีสมาชิกลงชื่อแล้วทั้งหมด ${totalPeople} คน (พร้อมลุย: ${countAvailablePeople} คน | ช่วยออนไลน์: ${countOnlinePeople} คน | ไม่ว่างเลย: ${countBusyPeople} คน)`;

  // วนลูปสร้างตารางรายชื่อ
  Object.keys(userMap).forEach(name => {
    const userRecords = userMap[name];
    userRecords.sort((a, b) => a.date.localeCompare(b.date));

    let datesHTML = '<div class="date-tags-container">';
    userRecords.forEach(rec => {
      let badgeClass = '';
      let statusIcon = '';
      
      if (rec.status === 'available') {
        badgeClass = 'available';
        statusIcon = '🟢';
      } else if (rec.status === 'busy-online') {
        badgeClass = 'busy-online';
        statusIcon = '🟡';
      } else {
        badgeClass = 'busy';
        statusIcon = '🔴';
      }

      const noteText = rec.reason && rec.reason !== '-' ? ` (${rec.reason})` : '';

      datesHTML += `
        <div class="date-tag-item">
          <span class="badge ${badgeClass}">${statusIcon} ${rec.date}</span>
          <span class="tag-note">${noteText}</span>
        </div>
      `;
    });
    datesHTML += '</div>';

    // ใช้ encodeURIComponent เพื่อป้องกันปัญหาชื่อคนมีเว้นวรรคหรือสัญลักษณ์พิเศษแล้วกดลบไม่ได้
    const safeName = encodeURIComponent(name);

    const row = `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${datesHTML}</td>
        <td style="text-align: center;">
          <button class="btn-delete" onclick="deleteUserAll('${safeName}')">Delete</button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });
});

// 3. ฟังก์ชันสำหรับบันทึกข้อมูลเข้า Firebase
document.getElementById('status-form').addEventListener('submit', function(e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const status = document.getElementById('status').value;
  const reason = document.getElementById('reason').value.trim();

  if (!name) return alert('นี่คุณณณ กรอกชื่อให้หน่อยได้ไหม');
  if (selectedDatesArray.length === 0) return alert('กรุณาเลือกอย่างน้อย 1 วันนะ');

  const promises = selectedDatesArray.map(dateStr => {
    return db.ref(`members/${dateStr}/${name}`).set({
      name: name,
      status: status,
      reason: status === 'available' ? '-' : (reason || 'ไม่ระบุเหตุผล'),
      updatedAt: new Date().toISOString()
    });
  });

  Promise.all(promises)
    .then(() => {
      alert(`บันทึกข้อมูลของคุณ "${name}" สำเร็จเรียบร้อยแล้วล่ะ!`);
      document.getElementById('reason').value = '';
    })
    .catch((err) => alert('โอ๊ะโอ.. เกิดข้อผิดพลาดในการบันทึกน่ะ: ' + err.message));
});

// 4. ฟังก์ชันลบข้อมูลของสมาชิกคนนั้นทั้งหมด (แยกอยู่นอกสุด)
function deleteUserAll(encodedName) {
  const name = decodeURIComponent(encodedName);
  
  if (confirm(`คุณต้องการลบข้อมูลทั้งหมดของ "${name}" ใช่ไหมนะ?`)) {
    db.ref('members').once('value')
      .then((snapshot) => {
        const allData = snapshot.val();
        if (!allData) return;

        const updates = {};
        Object.keys(allData).forEach(dateStr => {
          if (allData[dateStr] && allData[dateStr][name]) {
            updates[`members/${dateStr}/${name}`] = null;
          }
        });

        return db.ref().update(updates);
      })
      .then(() => {
        alert(`ลบข้อมูลของ "${name}" สำเร็จเรียบร้อยแล้ว!`);
      })
      .catch((err) => {
        console.error("Delete error:", err);
        alert('อ้าว เกิดข้อผิดพลาดในการลบน่ะ: ' + err.message);
      });
  }
}