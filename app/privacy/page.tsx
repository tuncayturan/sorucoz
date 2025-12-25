"use client";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] px-6 py-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Gizlilik Politikası</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-4">
            <strong>Son Güncelleme:</strong> {new Date().toLocaleDateString('tr-TR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Toplanan Bilgiler</h2>
            <p className="text-gray-600 mb-4">
              SoruÇöz uygulaması, hizmetlerimizi sağlamak için aşağıdaki bilgileri toplar:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Email adresi (Google Sign-In ile)</li>
              <li>Ad ve soyad</li>
              <li>Profil fotoğrafı (opsiyonel)</li>
              <li>Kullanım verileri ve analitik bilgiler</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Bilgilerin Kullanımı</h2>
            <p className="text-gray-600 mb-4">
              Toplanan bilgiler aşağıdaki amaçlarla kullanılır:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Hesap yönetimi ve kimlik doğrulama</li>
              <li>Hizmetlerimizi iyileştirme</li>
              <li>Kullanıcı desteği sağlama</li>
              <li>Yasal yükümlülükleri yerine getirme</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Bilgilerin Paylaşımı</h2>
            <p className="text-gray-600 mb-4">
              Kişisel bilgileriniz üçüncü taraflarla paylaşılmaz, ancak aşağıdaki durumlar hariç:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Yasal zorunluluklar</li>
              <li>Hizmet sağlayıcılarımız (Firebase, Railway vb.)</li>
              <li>Kullanıcının açık onayı ile</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Veri Güvenliği</h2>
            <p className="text-gray-600 mb-4">
              Verilerinizin güvenliği için endüstri standardı güvenlik önlemleri alınmaktadır.
              Firebase ve Railway gibi güvenilir platformlar kullanılmaktadır.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. İletişim</h2>
            <p className="text-gray-600 mb-4">
              Gizlilik politikamız hakkında sorularınız için lütfen bizimle iletişime geçin.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

