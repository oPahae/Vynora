// Contenu de la page /terms (termes et conditions), dans les 8 langues de l'application.
// Chaque section : [titre, paragraphe, liste a puces (optionnelle)].
// `{app}` est remplace par le nom de l'application. Le texte est un modele general :
// a faire relire / adapter par un juriste (editeur, droit applicable, contact) avant publication.
// Quand le texte change de facon substantielle, mettre a jour TERMS_VERSION et
// TERMS_UPDATED_AT dans lib/constants.js.

const fr = {
  title: 'Termes et conditions',
  updated: 'Dernière mise à jour',
  back: 'Retour',
  intro: "Bienvenue sur {app}. Les présents termes et conditions encadrent l'utilisation du service. Merci de les lire attentivement : en créant un compte, vous déclarez les accepter.",
  sections: [
    ['Acceptation des conditions', "En créant un compte ou en utilisant {app}, vous acceptez ces conditions. Si vous n'êtes pas d'accord, n'utilisez pas le service. Vous devez avoir au moins 13 ans, ou l'âge minimum requis par la loi de votre pays, pour créer un compte."],
    ['Votre compte', "Vous êtes responsable de votre compte et de tout ce qui s'y passe.", ["Fournissez des informations exactes et gardez-les à jour.", "Gardez votre mot de passe confidentiel et ne le partagez pas.", "Un compte par personne ; ne vous faites pas passer pour quelqu'un d'autre.", "Prévenez-nous immédiatement en cas d'accès non autorisé."]],
    ['Votre contenu', "Vous restez propriétaire de ce que vous publiez (publications, photos, vidéos, stories, reels, commentaires, messages). En le publiant, vous nous accordez une licence mondiale, non exclusive et gratuite pour l'héberger, l'afficher et le diffuser dans le service, uniquement pour faire fonctionner {app}. Vous garantissez avoir les droits nécessaires sur ce que vous publiez, et vous pouvez le supprimer à tout moment."],
    ['Règles de conduite', "Pour que {app} reste un espace agréable et sûr, il est interdit de :", ["harceler, menacer, inciter à la haine ou à la violence ;", "publier du contenu illégal, ou tout contenu sexuel impliquant des mineurs ;", "usurper une identité, tromper les autres ou faire des arnaques ;", "diffuser des informations privées sur autrui sans son accord ;", "envoyer du spam, manipuler les réactions ou les statistiques ;", "pirater le service, contourner ses protections ou collecter des données de façon automatisée."]],
    ['Localisation et personnes proches', "Le champ de localisation est facultatif. S'il est renseigné, il sert uniquement à détecter les personnes proches de vous (onglet « Proches de moi » des amis).", ["Elle peut être détectée automatiquement à l'inscription ; vous pouvez la modifier ou la laisser vide.", "Les autres membres voient seulement une distance approximative, jamais votre position exacte.", "Vous pouvez la modifier ou la supprimer à tout moment depuis votre profil ; sans localisation, vous n'apparaissez pas parmi les personnes proches.", "Les coordonnées sont enregistrées avec une précision réduite (environ 1 km)."]],
    ['Boost et niveau de fire', "Le niveau de fire affiché sur votre profil représente votre boost : il augmente avec votre niveau de réactions récent sur {app}. Il est donné à titre indicatif, peut évoluer, et nous pouvons ajuster son calcul. Il ne garantit aucune visibilité particulière. Générer des réactions artificielles pour l'augmenter est interdit."],
    ['Messagerie, Market et fonctions payantes', "Les annonces du Market et les échanges se font entre utilisateurs : {app} n'est pas partie aux transactions et n'en garantit pas l'issue. Les fonctions payantes (par exemple Premium) sont soumises aux conditions présentées au moment de l'achat."],
    ['Modération, suspension et recours', "Nous pouvons retirer un contenu, limiter ou suspendre un compte qui ne respecte pas ces conditions. Le motif vous est communiqué et, si votre compte est suspendu, vous pouvez déposer une demande de révision depuis la page prévue à cet effet."],
    ['Données personnelles', "Nous collectons uniquement les données nécessaires au fonctionnement du service et nous ne les vendons pas. Vous pouvez accéder à vos informations, les corriger ou supprimer votre compte. Nous utilisons des cookies et un stockage local pour votre session et vos préférences (langue, thème)."],
    ['Propriété intellectuelle', "Le nom {app}, son logo, son design et son code appartiennent à leur titulaire. Nous vous accordons un droit d'usage personnel, limité et révocable du service ; toute copie ou exploitation non autorisée est interdite."],
    ['Responsabilité', "Le service est fourni « en l'état », sans garantie de disponibilité continue ni d'absence d'erreur. Nous ne sommes pas responsables du contenu publié par les utilisateurs. Dans la limite permise par la loi, notre responsabilité est limitée aux dommages directs."],
    ['Résiliation', "Vous pouvez supprimer votre compte à tout moment. Nous pouvons suspendre ou supprimer un compte en cas de violation de ces conditions ou d'usage abusif du service."],
    ['Modifications', "Nous pouvons mettre à jour ces conditions. En cas de changement important, nous vous en informerons dans le service. Continuer à utiliser {app} après la mise à jour vaut acceptation."],
    ['Droit applicable et contact', "Ces conditions sont régies par la loi applicable dans le pays de l'éditeur du service, sous réserve des droits impératifs des consommateurs. Pour toute question, contactez-nous depuis l'application."]
  ]
};

const en = {
  title: 'Terms and conditions',
  updated: 'Last updated',
  back: 'Back',
  intro: 'Welcome to {app}. These terms and conditions govern your use of the service. Please read them carefully: by creating an account, you confirm that you accept them.',
  sections: [
    ['Acceptance of the terms', 'By creating an account or using {app}, you accept these terms. If you do not agree, please do not use the service. You must be at least 13 years old, or the minimum age required by the law of your country, to create an account.'],
    ['Your account', 'You are responsible for your account and everything that happens on it.', ['Provide accurate information and keep it up to date.', 'Keep your password confidential and do not share it.', 'One account per person; do not impersonate anyone else.', 'Tell us immediately if you notice unauthorized access.']],
    ['Your content', 'You remain the owner of what you post (posts, photos, videos, stories, reels, comments, messages). By posting it, you grant us a worldwide, non-exclusive, royalty-free licence to host, display and distribute it within the service, solely to operate {app}. You confirm that you have the necessary rights to what you post, and you can delete it at any time.'],
    ['Rules of conduct', 'To keep {app} a pleasant and safe place, you must not:', ['harass, threaten, or incite hatred or violence;', 'post illegal content, or any sexual content involving minors;', 'impersonate others, deceive people or run scams;', "share other people's private information without their consent;", 'send spam or manipulate reactions or statistics;', 'hack the service, bypass its protections or collect data automatically.']],
    ['Location and people nearby', 'The location field is optional. If you fill it in, it is used only to detect people near you (the "Near me" tab in friends).', ['It can be detected automatically at sign-up; you can change it or leave it empty.', 'Other members only see an approximate distance, never your exact position.', 'You can change or remove it at any time from your profile; without a location, you do not appear among nearby people.', 'Coordinates are stored with reduced precision (about 1 km).']],
    ['Boost and fire level', 'The fire level shown on your profile represents your boost: it grows with your recent level of reactions on {app}. It is indicative, may change, and we may adjust how it is calculated. It does not guarantee any particular visibility. Generating artificial reactions to raise it is prohibited.'],
    ['Messaging, Market and paid features', '{app} Market listings and exchanges take place between users: {app} is not a party to transactions and does not guarantee their outcome. Paid features (for example Premium) are subject to the terms presented at the time of purchase.'],
    ['Moderation, suspension and appeals', 'We may remove content, or limit or suspend an account that does not comply with these terms. You will be told the reason and, if your account is suspended, you can submit a review request from the dedicated page.'],
    ['Personal data', 'We only collect the data needed to run the service and we do not sell it. You can access your information, correct it, or delete your account. We use cookies and local storage for your session and preferences (language, theme).'],
    ['Intellectual property', 'The name {app}, its logo, design and code belong to their owner. We grant you a personal, limited and revocable right to use the service; any unauthorized copying or exploitation is prohibited.'],
    ['Liability', 'The service is provided "as is", without any guarantee of continuous availability or of being error-free. We are not responsible for content posted by users. To the extent permitted by law, our liability is limited to direct damages.'],
    ['Termination', 'You can delete your account at any time. We may suspend or delete an account in case of violation of these terms or abusive use of the service.'],
    ['Changes', 'We may update these terms. If a change is important, we will let you know within the service. Continuing to use {app} after an update means you accept it.'],
    ['Governing law and contact', "These terms are governed by the law applicable in the service operator's country, subject to mandatory consumer rights. If you have any questions, contact us from within the app."]
  ]
};

const es = {
  title: 'Términos y condiciones',
  updated: 'Última actualización',
  back: 'Volver',
  intro: 'Te damos la bienvenida a {app}. Estos términos y condiciones regulan el uso del servicio. Léelos con atención: al crear una cuenta, declaras que los aceptas.',
  sections: [
    ['Aceptación de los términos', 'Al crear una cuenta o usar {app}, aceptas estos términos. Si no estás de acuerdo, no uses el servicio. Debes tener al menos 13 años, o la edad mínima exigida por la ley de tu país, para crear una cuenta.'],
    ['Tu cuenta', 'Eres responsable de tu cuenta y de todo lo que ocurra en ella.', ['Proporciona información veraz y mantenla actualizada.', 'Mantén tu contraseña en secreto y no la compartas.', 'Una cuenta por persona; no te hagas pasar por otra persona.', 'Avísanos de inmediato si detectas un acceso no autorizado.']],
    ['Tu contenido', 'Sigues siendo el propietario de lo que publicas (publicaciones, fotos, vídeos, historias, reels, comentarios, mensajes). Al publicarlo, nos concedes una licencia mundial, no exclusiva y gratuita para alojarlo, mostrarlo y distribuirlo dentro del servicio, únicamente para hacer funcionar {app}. Garantizas que tienes los derechos necesarios sobre lo que publicas, y puedes eliminarlo en cualquier momento.'],
    ['Normas de conducta', 'Para que {app} siga siendo un espacio agradable y seguro, está prohibido:', ['acosar, amenazar o incitar al odio o a la violencia;', 'publicar contenido ilegal o cualquier contenido sexual que involucre a menores;', 'suplantar identidades, engañar a otros o cometer estafas;', 'difundir información privada de otras personas sin su consentimiento;', 'enviar spam o manipular las reacciones o las estadísticas;', 'vulnerar el servicio, eludir sus protecciones o recopilar datos de forma automatizada.']],
    ['Ubicación y personas cercanas', 'El campo de ubicación es opcional. Si lo rellenas, se usa únicamente para detectar a las personas cercanas a ti (pestaña «Cerca de mí» en amigos).', ['Puede detectarse automáticamente al registrarte; puedes modificarla o dejarla vacía.', 'Los demás miembros solo ven una distancia aproximada, nunca tu posición exacta.', 'Puedes modificarla o eliminarla en cualquier momento desde tu perfil; sin ubicación, no apareces entre las personas cercanas.', 'Las coordenadas se guardan con precisión reducida (alrededor de 1 km).']],
    ['Boost y nivel de fire', 'El nivel de fire que se muestra en tu perfil representa tu boost: aumenta con tu nivel reciente de reacciones en {app}. Es orientativo, puede cambiar y podemos ajustar su cálculo. No garantiza ninguna visibilidad concreta. Está prohibido generar reacciones artificiales para aumentarlo.'],
    ['Mensajería, Market y funciones de pago', 'Los anuncios y los intercambios del Market se realizan entre usuarios: {app} no es parte de las transacciones y no garantiza su resultado. Las funciones de pago (por ejemplo, Premium) están sujetas a las condiciones presentadas en el momento de la compra.'],
    ['Moderación, suspensión y recursos', 'Podemos eliminar contenido, o limitar o suspender una cuenta que incumpla estos términos. Se te comunicará el motivo y, si tu cuenta es suspendida, podrás enviar una solicitud de revisión desde la página prevista para ello.'],
    ['Datos personales', 'Solo recopilamos los datos necesarios para el funcionamiento del servicio y no los vendemos. Puedes acceder a tu información, corregirla o eliminar tu cuenta. Usamos cookies y almacenamiento local para tu sesión y tus preferencias (idioma, tema).'],
    ['Propiedad intelectual', 'El nombre {app}, su logotipo, su diseño y su código pertenecen a su titular. Te concedemos un derecho de uso personal, limitado y revocable del servicio; queda prohibida cualquier copia o explotación no autorizada.'],
    ['Responsabilidad', 'El servicio se ofrece «tal cual», sin garantía de disponibilidad continua ni de ausencia de errores. No somos responsables del contenido publicado por los usuarios. En la medida permitida por la ley, nuestra responsabilidad se limita a los daños directos.'],
    ['Cancelación', 'Puedes eliminar tu cuenta en cualquier momento. Podemos suspender o eliminar una cuenta en caso de incumplimiento de estos términos o de uso abusivo del servicio.'],
    ['Modificaciones', 'Podemos actualizar estos términos. Si el cambio es importante, te lo comunicaremos dentro del servicio. Seguir usando {app} tras la actualización implica su aceptación.'],
    ['Ley aplicable y contacto', 'Estos términos se rigen por la ley aplicable en el país del editor del servicio, sin perjuicio de los derechos imperativos de los consumidores. Si tienes alguna pregunta, contáctanos desde la aplicación.']
  ]
};

const it = {
  title: 'Termini e condizioni',
  updated: 'Ultimo aggiornamento',
  back: 'Indietro',
  intro: 'Benvenuto su {app}. Questi termini e condizioni regolano l’uso del servizio. Leggili con attenzione: creando un account dichiari di accettarli.',
  sections: [
    ['Accettazione dei termini', 'Creando un account o usando {app}, accetti questi termini. Se non sei d’accordo, non usare il servizio. Devi avere almeno 13 anni, o l’età minima richiesta dalla legge del tuo paese, per creare un account.'],
    ['Il tuo account', 'Sei responsabile del tuo account e di tutto ciò che vi accade.', ['Fornisci informazioni corrette e mantienile aggiornate.', 'Mantieni riservata la tua password e non condividerla.', 'Un account per persona; non spacciarti per qualcun altro.', 'Avvisaci subito in caso di accesso non autorizzato.']],
    ['I tuoi contenuti', 'Resti proprietario di ciò che pubblichi (post, foto, video, storie, reel, commenti, messaggi). Pubblicandolo, ci concedi una licenza mondiale, non esclusiva e gratuita per ospitarlo, mostrarlo e distribuirlo all’interno del servizio, al solo scopo di far funzionare {app}. Garantisci di avere i diritti necessari su ciò che pubblichi e puoi eliminarlo in qualsiasi momento.'],
    ['Regole di condotta', 'Perché {app} resti un luogo piacevole e sicuro, è vietato:', ['molestare, minacciare o incitare all’odio o alla violenza;', 'pubblicare contenuti illegali o contenuti sessuali che coinvolgono minori;', 'sostituirsi ad altre persone, ingannare o fare truffe;', 'diffondere informazioni private di altri senza il loro consenso;', 'inviare spam o manipolare reazioni e statistiche;', 'violare il servizio, aggirarne le protezioni o raccogliere dati in modo automatizzato.']],
    ['Posizione e persone vicine', 'Il campo della posizione è facoltativo. Se lo compili, viene usato solo per rilevare le persone vicine a te (scheda «Vicino a me» negli amici).', ['Può essere rilevata automaticamente alla registrazione; puoi modificarla o lasciarla vuota.', 'Gli altri membri vedono solo una distanza approssimativa, mai la tua posizione esatta.', 'Puoi modificarla o rimuoverla in qualsiasi momento dal tuo profilo; senza posizione, non compari tra le persone vicine.', 'Le coordinate vengono salvate con precisione ridotta (circa 1 km).']],
    ['Boost e livello di fire', 'Il livello di fire mostrato sul tuo profilo rappresenta il tuo boost: aumenta con il tuo livello recente di reazioni su {app}. È indicativo, può cambiare e possiamo modificarne il calcolo. Non garantisce alcuna visibilità particolare. È vietato generare reazioni artificiali per aumentarlo.'],
    ['Messaggi, Market e funzioni a pagamento', 'Gli annunci e gli scambi del Market avvengono tra utenti: {app} non è parte delle transazioni e non ne garantisce l’esito. Le funzioni a pagamento (ad esempio Premium) sono soggette alle condizioni presentate al momento dell’acquisto.'],
    ['Moderazione, sospensione e ricorsi', 'Possiamo rimuovere contenuti, limitare o sospendere un account che non rispetta questi termini. Ti verrà comunicato il motivo e, se il tuo account viene sospeso, potrai inviare una richiesta di revisione dalla pagina dedicata.'],
    ['Dati personali', 'Raccogliamo solo i dati necessari al funzionamento del servizio e non li vendiamo. Puoi accedere alle tue informazioni, correggerle o eliminare il tuo account. Usiamo cookie e archiviazione locale per la sessione e le preferenze (lingua, tema).'],
    ['Proprietà intellettuale', 'Il nome {app}, il suo logo, il design e il codice appartengono al loro titolare. Ti concediamo un diritto d’uso personale, limitato e revocabile del servizio; qualsiasi copia o sfruttamento non autorizzato è vietato.'],
    ['Responsabilità', 'Il servizio è fornito «così com’è», senza garanzia di disponibilità continua o di assenza di errori. Non siamo responsabili dei contenuti pubblicati dagli utenti. Nei limiti consentiti dalla legge, la nostra responsabilità è limitata ai danni diretti.'],
    ['Cessazione', 'Puoi eliminare il tuo account in qualsiasi momento. Possiamo sospendere o eliminare un account in caso di violazione di questi termini o di uso abusivo del servizio.'],
    ['Modifiche', 'Possiamo aggiornare questi termini. In caso di modifica importante, te lo comunicheremo all’interno del servizio. Continuare a usare {app} dopo l’aggiornamento significa accettarlo.'],
    ['Legge applicabile e contatti', 'Questi termini sono regolati dalla legge applicabile nel paese dell’editore del servizio, fatti salvi i diritti inderogabili dei consumatori. Per qualsiasi domanda, contattaci dall’app.']
  ]
};

const ru = {
  title: 'Условия использования',
  updated: 'Последнее обновление',
  back: 'Назад',
  intro: 'Добро пожаловать в {app}. Настоящие условия регулируют использование сервиса. Пожалуйста, внимательно прочитайте их: создавая аккаунт, вы подтверждаете, что принимаете их.',
  sections: [
    ['Принятие условий', 'Создавая аккаунт или используя {app}, вы принимаете эти условия. Если вы не согласны, не пользуйтесь сервисом. Для создания аккаунта вам должно быть не менее 13 лет или достигнут минимальный возраст, установленный законодательством вашей страны.'],
    ['Ваш аккаунт', 'Вы отвечаете за свой аккаунт и за всё, что в нём происходит.', ['Указывайте достоверные данные и поддерживайте их актуальность.', 'Храните пароль в тайне и никому его не передавайте.', 'Один аккаунт на человека; не выдавайте себя за другого.', 'Немедленно сообщайте нам о несанкционированном доступе.']],
    ['Ваш контент', 'Вы остаётесь владельцем того, что публикуете (публикации, фото, видео, истории, reels, комментарии, сообщения). Публикуя контент, вы предоставляете нам всемирную неисключительную безвозмездную лицензию на его хранение, показ и распространение внутри сервиса — только для работы {app}. Вы подтверждаете, что обладаете необходимыми правами на публикуемое, и можете удалить его в любой момент.'],
    ['Правила поведения', 'Чтобы {app} оставался приятным и безопасным местом, запрещается:', ['преследовать, угрожать, разжигать ненависть или насилие;', 'публиковать незаконный контент или любой сексуальный контент с участием несовершеннолетних;', 'выдавать себя за других, обманывать или мошенничать;', 'распространять чужую личную информацию без согласия;', 'рассылать спам, накручивать реакции или статистику;', 'взламывать сервис, обходить его защиту или автоматически собирать данные.']],
    ['Местоположение и люди поблизости', 'Поле местоположения необязательно. Если вы его заполните, оно используется только для поиска людей рядом с вами (вкладка «Рядом со мной» в друзьях).', ['Оно может определяться автоматически при регистрации; вы можете изменить его или оставить пустым.', 'Другие участники видят только примерное расстояние, но никогда не вашу точную позицию.', 'Вы можете изменить или удалить его в любой момент в профиле; без местоположения вы не появляетесь среди людей поблизости.', 'Координаты хранятся с пониженной точностью (около 1 км).']],
    ['Буст и уровень fire', 'Уровень fire в вашем профиле отражает ваш буст: он растёт вместе с вашей недавней активностью реакций в {app}. Он носит информационный характер, может меняться, а способ его расчёта мы можем корректировать. Он не гарантирует какой-либо видимости. Создавать искусственные реакции для его повышения запрещено.'],
    ['Сообщения, Market и платные функции', 'Объявления и сделки в Market происходят между пользователями: {app} не является стороной сделок и не гарантирует их результат. Платные функции (например, Premium) регулируются условиями, показанными при покупке.'],
    ['Модерация, блокировка и обжалование', 'Мы можем удалить контент, ограничить или заблокировать аккаунт, нарушающий эти условия. Вам сообщат причину, а в случае блокировки вы сможете отправить запрос на пересмотр на специальной странице.'],
    ['Персональные данные', 'Мы собираем только данные, необходимые для работы сервиса, и не продаём их. Вы можете получить доступ к своим данным, исправить их или удалить аккаунт. Мы используем cookie и локальное хранилище для вашей сессии и настроек (язык, тема).'],
    ['Интеллектуальная собственность', 'Название {app}, его логотип, дизайн и код принадлежат правообладателю. Мы предоставляем вам личное, ограниченное и отзываемое право использования сервиса; любое несанкционированное копирование или использование запрещено.'],
    ['Ответственность', 'Сервис предоставляется «как есть», без гарантии постоянной доступности и отсутствия ошибок. Мы не отвечаем за контент, опубликованный пользователями. В пределах, допускаемых законом, наша ответственность ограничена прямым ущербом.'],
    ['Прекращение использования', 'Вы можете удалить свой аккаунт в любой момент. Мы можем заблокировать или удалить аккаунт при нарушении этих условий или злоупотреблении сервисом.'],
    ['Изменения', 'Мы можем обновлять эти условия. О существенных изменениях мы сообщим внутри сервиса. Продолжая пользоваться {app} после обновления, вы принимаете его.'],
    ['Применимое право и контакты', 'Эти условия регулируются правом страны оператора сервиса с учётом обязательных прав потребителей. По любым вопросам свяжитесь с нами из приложения.']
  ]
};

const ar = {
  title: 'الشروط والأحكام',
  updated: 'آخر تحديث',
  back: 'رجوع',
  intro: 'مرحبًا بك في {app}. تنظّم هذه الشروط والأحكام استخدامك للخدمة. يُرجى قراءتها بعناية: بإنشاء حساب فإنك تقرّ بقبولها.',
  sections: [
    ['قبول الشروط', 'بإنشاء حساب أو استخدام {app} فإنك توافق على هذه الشروط. إذا لم توافق عليها فلا تستخدم الخدمة. يجب ألا يقل عمرك عن 13 عامًا، أو الحد الأدنى للسن المطلوب بموجب قانون بلدك، لإنشاء حساب.'],
    ['حسابك', 'أنت مسؤول عن حسابك وعن كل ما يحدث فيه.', ['قدّم معلومات صحيحة وحافظ على تحديثها.', 'حافظ على سرية كلمة المرور ولا تشاركها.', 'حساب واحد لكل شخص؛ ولا تنتحل شخصية أي أحد.', 'أبلغنا فورًا عند ملاحظة أي دخول غير مصرّح به.']],
    ['المحتوى الذي تنشره', 'تظل مالكًا لما تنشره (المنشورات والصور ومقاطع الفيديو والقصص والريلز والتعليقات والرسائل). وبنشره تمنحنا ترخيصًا عالميًا غير حصري ومجانيًا لاستضافته وعرضه وتوزيعه داخل الخدمة، لغرض تشغيل {app} فقط. وتؤكد أن لديك الحقوق اللازمة على ما تنشره، ويمكنك حذفه في أي وقت.'],
    ['قواعد السلوك', 'لكي يبقى {app} مكانًا ممتعًا وآمنًا، يُمنع:', ['المضايقة أو التهديد أو التحريض على الكراهية أو العنف؛', 'نشر محتوى غير قانوني أو أي محتوى جنسي يتعلق بقاصرين؛', 'انتحال شخصية الآخرين أو خداعهم أو الاحتيال عليهم؛', 'نشر معلومات خاصة بالآخرين دون موافقتهم؛', 'إرسال رسائل مزعجة أو التلاعب بالتفاعلات أو الإحصاءات؛', 'اختراق الخدمة أو تجاوز حمايتها أو جمع البيانات آليًا.']],
    ['الموقع والأشخاص القريبون', 'حقل الموقع اختياري. وإذا ملأته فإنه يُستخدم فقط لاكتشاف الأشخاص القريبين منك (تبويب «القريبون مني» في الأصدقاء).', ['يمكن اكتشافه تلقائيًا عند التسجيل؛ ويمكنك تعديله أو تركه فارغًا.', 'لا يرى الأعضاء الآخرون سوى مسافة تقريبية، ولا يرون موقعك الدقيق أبدًا.', 'يمكنك تعديله أو حذفه في أي وقت من ملفك الشخصي؛ وبدون موقع لن تظهر بين الأشخاص القريبين.', 'تُحفظ الإحداثيات بدقة مخفّضة (نحو 1 كم).']],
    ['البوست ومستوى النار (fire)', 'يمثّل مستوى النار المعروض في ملفك الشخصي البوست الخاص بك: فهو يزداد مع مستوى تفاعلك الأخير في {app}. وهو للإرشاد فقط وقد يتغيّر، ويجوز لنا تعديل طريقة حسابه. ولا يضمن أي ظهور معيّن. ويُمنع إنشاء تفاعلات مصطنعة لرفعه.'],
    ['المراسلة والسوق والميزات المدفوعة', 'تتم إعلانات السوق وتبادلاتها بين المستخدمين: و{app} ليس طرفًا في المعاملات ولا يضمن نتيجتها. وتخضع الميزات المدفوعة (مثل Premium) للشروط المعروضة وقت الشراء.'],
    ['الإشراف والتعليق والطعن', 'يجوز لنا حذف المحتوى أو تقييد أو تعليق أي حساب لا يلتزم بهذه الشروط. وسيتم إبلاغك بالسبب، وإذا عُلّق حسابك فيمكنك تقديم طلب مراجعة من الصفحة المخصصة لذلك.'],
    ['البيانات الشخصية', 'نجمع فقط البيانات اللازمة لتشغيل الخدمة ولا نبيعها. يمكنك الاطلاع على معلوماتك وتصحيحها أو حذف حسابك. نستخدم ملفات تعريف الارتباط والتخزين المحلي لجلستك وتفضيلاتك (اللغة والمظهر).'],
    ['الملكية الفكرية', 'اسم {app} وشعاره وتصميمه وشيفرته مملوكة لصاحبها. ونمنحك حقًا شخصيًا محدودًا وقابلًا للإلغاء في استخدام الخدمة؛ ويُمنع أي نسخ أو استغلال غير مصرّح به.'],
    ['المسؤولية', 'تُقدَّم الخدمة «كما هي» دون ضمان لتوفرها باستمرار أو لخلوها من الأخطاء. ولسنا مسؤولين عن المحتوى الذي ينشره المستخدمون. وفي الحدود التي يسمح بها القانون، تقتصر مسؤوليتنا على الأضرار المباشرة.'],
    ['الإنهاء', 'يمكنك حذف حسابك في أي وقت. ويجوز لنا تعليق حساب أو حذفه عند مخالفة هذه الشروط أو إساءة استخدام الخدمة.'],
    ['التعديلات', 'قد نقوم بتحديث هذه الشروط. وفي حال حدوث تغيير مهم سنبلغك به داخل الخدمة. ويعني استمرارك في استخدام {app} بعد التحديث قبولك له.'],
    ['القانون المطبّق والتواصل', 'تخضع هذه الشروط للقانون المعمول به في بلد مشغّل الخدمة، مع مراعاة حقوق المستهلك الإلزامية. لأي استفسار، تواصل معنا من داخل التطبيق.']
  ]
};

const ja = {
  title: '利用規約',
  updated: '最終更新日',
  back: '戻る',
  intro: '{app}へようこそ。本利用規約は、本サービスの利用に関する条件を定めるものです。よくお読みください。アカウントを作成することで、本規約に同意したものとみなされます。',
  sections: [
    ['規約への同意', 'アカウントを作成するか{app}を利用することで、本規約に同意したものとします。同意できない場合は、本サービスを利用しないでください。アカウントの作成には、13歳以上、またはお住まいの国の法律で定められた最低年齢に達している必要があります。'],
    ['アカウント', 'お客様は、ご自身のアカウントおよびそこで行われるすべての行為に責任を負います。', ['正確な情報を提供し、常に最新の状態に保ってください。', 'パスワードは秘密にし、他人と共有しないでください。', '1人1アカウントとし、他人になりすまさないでください。', '不正アクセスに気づいた場合は、直ちにご連絡ください。']],
    ['投稿コンテンツ', '投稿した内容（投稿、写真、動画、ストーリー、リール、コメント、メッセージ）の権利はお客様に残ります。投稿することで、お客様は、{app}の運営のためにのみ、本サービス内でそれを保存、表示、配信するための、世界的、非独占的、無償のライセンスを当社に付与するものとします。お客様は投稿内容に必要な権利を有していることを保証し、いつでも削除できます。'],
    ['行動規範', '{app}を快適で安全な場所に保つため、次の行為は禁止されています。', ['嫌がらせ、脅迫、憎悪や暴力の扇動', '違法なコンテンツ、または未成年者に関わる性的コンテンツの投稿', 'なりすまし、他者を欺く行為、詐欺', '本人の同意なく他人の個人情報を公開すること', 'スパムの送信、リアクションや統計の不正操作', 'サービスへの不正アクセス、保護機能の回避、自動的なデータ収集']],
    ['位置情報と近くの人', '位置情報の入力は任意です。入力した場合、近くにいる人を見つけるためにのみ使用されます（友達の「近くの人」タブ）。', ['登録時に自動で検出されることがあります。変更も、空欄のままにすることもできます。', '他のメンバーには、おおよその距離のみが表示され、正確な位置が表示されることはありません。', 'プロフィールからいつでも変更または削除できます。位置情報がない場合、近くの人として表示されません。', '座標は精度を下げて（約1km）保存されます。']],
    ['ブーストとファイアレベル', 'プロフィールに表示されるファイアレベルはブーストを表し、{app}での最近のリアクションの多さに応じて上がります。これは目安であり、変更されることがあり、計算方法を調整する場合があります。特定の表示を保証するものではありません。レベルを上げるために人為的にリアクションを生み出すことは禁止されています。'],
    ['メッセージ、マーケット、有料機能', 'マーケットの出品や取引はユーザー間で行われます。{app}は取引の当事者ではなく、その結果を保証しません。有料機能（Premiumなど）は、購入時に提示される条件に従います。'],
    ['モデレーション、停止、異議申し立て', '本規約に違反するコンテンツを削除し、アカウントを制限または停止することがあります。理由はお知らせし、アカウントが停止された場合は、専用ページから審査をリクエストできます。'],
    ['個人データ', '当社は、サービスの運営に必要なデータのみを収集し、販売することはありません。お客様はご自身の情報にアクセスし、訂正し、またはアカウントを削除できます。セッションや設定（言語、テーマ）のために、Cookieとローカルストレージを使用します。'],
    ['知的財産', '{app}の名称、ロゴ、デザイン、コードは権利者に帰属します。お客様には、本サービスを個人的に利用するための限定的かつ取り消し可能な権利を付与します。無断での複製や利用は禁止されています。'],
    ['責任', '本サービスは「現状有姿」で提供され、継続的な提供やエラーがないことを保証しません。ユーザーが投稿したコンテンツについて、当社は責任を負いません。法律で認められる範囲で、当社の責任は直接損害に限定されます。'],
    ['利用の終了', 'アカウントはいつでも削除できます。本規約への違反やサービスの不正利用があった場合、アカウントを停止または削除することがあります。'],
    ['規約の変更', '本規約を更新する場合があります。重要な変更がある場合は、サービス内でお知らせします。更新後も{app}を使い続けた場合、変更に同意したものとみなされます。'],
    ['準拠法とお問い合わせ', '本規約は、消費者の強行法規上の権利を妨げない範囲で、サービス運営者の所在国の法律に準拠します。ご質問は、アプリ内からお問い合わせください。']
  ]
};

const zh = {
  title: '条款与条件',
  updated: '最后更新',
  back: '返回',
  intro: '欢迎使用{app}。本条款与条件规范您对本服务的使用。请仔细阅读：创建账户即表示您接受这些条款。',
  sections: [
    ['条款的接受', '创建账户或使用{app}，即表示您接受本条款。如果您不同意，请不要使用本服务。创建账户须年满13周岁，或达到您所在国家法律规定的最低年龄。'],
    ['您的账户', '您须对自己的账户以及账户内发生的一切负责。', ['提供真实信息并保持更新。', '妥善保管密码，不要与他人分享。', '每人一个账户；不得冒充他人。', '发现未经授权的访问时请立即通知我们。']],
    ['您的内容', '您发布的内容（帖子、照片、视频、快拍、短视频、评论、消息）仍归您所有。发布即表示您授予我们全球范围内的、非独占的、免费的许可，仅为运营{app}而在服务内托管、展示和分发这些内容。您保证对所发布的内容拥有必要的权利，并且可以随时删除。'],
    ['行为准则', '为了让{app}保持愉快和安全，禁止以下行为：', ['骚扰、威胁，或煽动仇恨与暴力；', '发布违法内容，或任何涉及未成年人的色情内容；', '冒充他人、欺骗他人或实施诈骗；', '未经同意公开他人的私人信息；', '发送垃圾信息，或操纵互动与统计数据；', '入侵本服务、绕过其保护措施或自动化收集数据。']],
    ['位置与附近的人', '位置字段为选填。如果您填写，它仅用于发现您附近的人（好友中的“附近的人”标签）。', ['注册时可自动检测；您可以修改，也可以留空。', '其他成员只能看到大致距离，永远看不到您的确切位置。', '您可以随时在个人资料中修改或删除；没有位置信息时，您不会出现在附近的人中。', '坐标会以较低精度保存（约1公里）。']],
    ['Boost 与 fire 等级', '您个人资料上显示的 fire 等级代表您的 boost：它会随着您近期在{app}上的互动（反应）水平而提高。该等级仅供参考，可能会变化，我们也可能调整其计算方式。它不保证任何特定的曝光。禁止通过制造虚假互动来提高等级。'],
    ['消息、Market 与付费功能', 'Market 的发布与交易在用户之间进行：{app}不是交易的当事方，也不保证交易结果。付费功能（例如 Premium）适用购买时展示的条款。'],
    ['审核、暂停与申诉', '对于违反本条款的内容或账户，我们可能删除内容，或限制、暂停账户。我们会告知原因；如果您的账户被暂停，可以通过专门页面提交复核申请。'],
    ['个人数据', '我们仅收集运营本服务所需的数据，并且不会出售。您可以访问、更正您的信息，或删除账户。我们使用 Cookie 和本地存储来保存您的会话与偏好（语言、主题）。'],
    ['知识产权', '{app}的名称、标志、设计和代码归其权利人所有。我们授予您个人的、有限的、可撤销的服务使用权；禁止任何未经授权的复制或利用。'],
    ['责任', '本服务按“现状”提供，不保证持续可用或无错误。我们不对用户发布的内容负责。在法律允许的范围内，我们的责任仅限于直接损失。'],
    ['终止', '您可以随时删除账户。如果违反本条款或滥用本服务，我们可能暂停或删除账户。'],
    ['条款的变更', '我们可能更新本条款。如有重要变更，我们会在服务内通知您。更新后继续使用{app}，即视为接受更新。'],
    ['适用法律与联系方式', '在不影响消费者强制性权利的前提下，本条款受服务运营方所在国家的适用法律管辖。如有疑问，请通过应用内联系我们。']
  ]
};

export const TERMS_CONTENT = { fr, en, es, it, ru, ar, ja, zh };

export function getTermsContent(locale) {
  return TERMS_CONTENT[locale] || TERMS_CONTENT.fr;
}
