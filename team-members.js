const teamMembersData = {
  "mostafa-zain": {
    name: "أ.د / مصطفى زين",
    role: "شريك المؤسسه",
    image: "assets/team/mostafa-zain.jpg",
    points: [
      "المستشار القانوني للعقود والمعاملات الدوليه الدولي للمؤسسه",
      "المحامي بالنقض والاداريه العليا والدستوريه",
      "المستشار القانوني للعديد من الجهات الدولية والحكوميه",
      "خبير الحكومة ومكافحة الفساد والعقود الدولية",
      "المعاملات المصرفية الدولية",
    ],
  },
  "mahmoud-elgayar": {
    name: "أ / محمود الجيار",
    role: "المدير التنفيذى وشريك مؤسس",
    image: "assets/team/mahmoud-elgayar.jpg",
    points: [
      "المحامي بالنقض والاداريه العليا والدستوريه و عضو اتحاد المحامين العرب",
      "ماجستير في الحقوق",
      "دبلوما القانون الخاص",
      "دبلوما العلوم الاداريه",
      "باحث دكتوراه قسم القانون العام",
      "المستشار القانوني لعدد من الشركات",
      "درجة القيد : نقض",
    ],
  },
  "mahmoud-ahmed-emam": {
    name: "أ / محمود احمد امام",
    role: "المحامي بالنقض",
    image: "assets/team/mahmoud-ahmed-emam.jpg",
    points: ["المحاميى بالنقض والاداريه العليا والدستوريه"],
  },
  "fahima-ahmed-alkomary": {
    name: "د / فهيمة أحمد علي القماري",
    role: "أستاذ قانون المرافعات",
    image: "assets/team/fahima-ahmed-alkomary.jpg",
    points: [
      "أستاذ قانون المرافعات - كلية الحقوق جامعة الإسكندرية",
      "أستاذ القانون كلية النقل البحري - الأكاديمية العربية للنقل البحري",
      "أستاذ القانون في المعهد العالي للعلوم الإدارية المتقدمة والحاسبات",
      "مساعد عميد كلية الحقوق السابق",
      "المستشار العلمي للدرسات العليا لنقابة المحامين سابقا",
      "عضو الجمعية العربية للملاحة",
      "عضو جمعية أصدقاء مكتبة الإسكندرية",
      "المحامي بالنقض",
    ],
  },
  "ibrahim-ali-aref": {
    name: "أ / ابراهيم علي عارف",
    role: "المدير العام مكتب القاهرة",
    image: "assets/team/ibrahim-ali-aref.jpg",
    points: ["المحامي بالنقض والادارية العليا والدستورية"],
  },
  "noha-mohamed-elsayed": {
    name: "أ / نهي محمد السيد",
    role: "مستشار قضايا الاسرة",
    image: "assets/team/noha-mohamed-elsayed.jpg",
    points: ["المحاميه بالنقض والاداريه العليا والدستوريه"],
  },
  "nassar-metwaly-nassar": {
    name: "أ / نصار متولي نصار",
    role: "المدير التنفيذي لمكتب الاسكندرية",
    image: "assets/team/nassar-metwaly-nassar.jpeg",
    points: ["المحامي بالنقض والادارية العليا والدستورية"],
  },
  "mohamed-ahmed-daghidy": {
    name: "أ / محمد احمد دغيدي",
    role: "المحامي بالنقض",
    image: "assets/team/mohamed-ahmed-daghidy.jpg",
    points: ["المحامي بالنقض والاداريه العليا والدستوريه"],
  },
  "mohamed-abdelhafiz": {
    name: "أ / محمد عبدالحفيظ",
    role: "المحامي بالاستئناف العالي ومجلس الدوله",
    image: "assets/team/mohamed-abdelhafiz.jpg",
    points: ["حاصل علي ماجستير في الحقوق باحث دكتوراه في الاقتصاد"],
  },
  "mohamed-shaheen": {
    name: "أ / محمد شاهين",
    role: "المدير التنفيذي لمكتب الأسكندريه والعلمين",
    image: "assets/team/mohamed-shaheen.jpg",
    points: ["المحامي بالاستئناف العالي ومجلس الدوله"],
  },
  "abdulaziz-elgayar": {
    name: "أ / عبد العزيز الجيار",
    role: "المحامى",
    image: "assets/team/abdulaziz-elgayar.jpg",
    points: ["دبلوم القانون الخاص", "دبلوم القانون العام", "حاصل علي ماجستير في الحقوق"],
  },
  "ahmed-ibrahim-elkhediwy": {
    name: "أ / احمد ابراهيم الخديوي",
    role: "المحامى",
    image: "assets/team/ahmed-ibrahim-elkhediwy.jpg",
    points: [],
  },
  "mohamed-magdy": {
    name: "أ / محمد مجدي",
    role: "المحامى",
    image: "assets/team/mohamed-magdy.jpg",
    points: [],
  },
  "mai-hanafy": {
    name: "أ / مى حنفى",
    role: "المدير الاداري",
    image: "assets/team/mai-hanafy.jpg",
    points: ["المحاميه"],
  },
  "aya-mostafa-zain": {
    name: "أ / اية مصطفى زين",
    role: "المحامية",
    image: "assets/team/aya-mostafa-zain.jpg",
    points: [],
  },
  "wesam-talal": {
    name: "أ / وسام طلال",
    role: "المحامي بالاستئناف العالي ومجلس الدوله",
    image: "assets/team/wesam-talal.jpg",
    points: ["ماجستير بالقانون الدولي", "دبلومة خبير قانونى معتمد من حكومة دبي"],
  },
};

const memberContainer = document.querySelector("#memberDetail");
if (memberContainer) {
  const params = new URLSearchParams(window.location.search);
  const memberId = params.get("id");
  const member = memberId ? teamMembersData[memberId] : null;

  if (!member) {
    memberContainer.innerHTML = `
      <h2>العضو غير موجود</h2>
      <p>يرجى العودة إلى صفحة فريق العمل واختيار عضو صحيح.</p>
      <a class="btn" href="team.html">العودة إلى فريق العمل</a>
    `;
  } else {
    const pointsMarkup = member.points.length
      ? `<ul>${member.points.map((point) => `<li>${point}</li>`).join("")}</ul>`
      : "<p>لا توجد تفاصيل إضافية حالياً.</p>";

    memberContainer.innerHTML = `
      <div class="team-member-detail-head">
        <img class="team-photo" src="${member.image}" alt="${member.name}" loading="lazy" />
        <div>
          <h2>${member.name}</h2>
          <p>${member.role}</p>
        </div>
      </div>
      <div class="team-member-detail-body">
        ${pointsMarkup}
      </div>
      <a class="btn" href="team.html">العودة إلى فريق العمل</a>
    `;
  }
}
