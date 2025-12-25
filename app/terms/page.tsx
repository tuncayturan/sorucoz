"use client";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] px-6 py-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Kullanım Koşulları</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-4">
            <strong>Son Güncelleme:</strong> {new Date().toLocaleDateString('tr-TR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Hizmetlerin Kullanımı</h2>
            <p className="text-gray-600 mb-4">
              SoruÇöz uygulamasını kullanarak, aşağıdaki koşulları kabul etmiş olursunuz:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Hizmetlerimizi yasalara uygun şekilde kullanacaksınız</li>
              <li>Başkalarının haklarına saygı göstereceksiniz</li>
              <li>Hesap bilgilerinizi güvende tutacaksınız</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Kullanıcı Sorumlulukları</h2>
            <p className="text-gray-600 mb-4">
              Kullanıcılar aşağıdakilerden sorumludur:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Hesap güvenliğini sağlamak</li>
              <li>Yanlış veya yanıltıcı bilgi paylaşmamak</li>
              <li>Hizmetleri kötüye kullanmamak</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Fikri Mülkiyet</h2>
            <p className="text-gray-600 mb-4">
              SoruÇöz uygulaması ve içeriği telif hakkı ile korunmaktadır.
              İçeriği izinsiz kopyalamak, dağıtmak veya kullanmak yasaktır.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Hizmet Değişiklikleri</h2>
            <p className="text-gray-600 mb-4">
              Hizmetlerimizi herhangi bir zamanda değiştirme, askıya alma veya sonlandırma hakkımız saklıdır.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Sorumluluk Reddi</h2>
            <p className="text-gray-600 mb-4">
              Hizmetlerimiz "olduğu gibi" sunulmaktadır. 
              Mümkün olan en iyi çabayı göstermemize rağmen, hizmetlerin kesintisiz veya hatasız olacağını garanti edemeyiz.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. İletişim</h2>
            <p className="text-gray-600 mb-4">
              Kullanım koşullarımız hakkında sorularınız için lütfen bizimle iletişime geçin.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

