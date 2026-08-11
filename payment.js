(function () {
  "use strict";

  var config = window.JUBIELEE_STOREFRONT_CONFIG || {};
  var API_BASE = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  var params = new URLSearchParams(window.location.search);
  var checkoutToken = clean(params.get("token"));

  var elements = {
    title: document.getElementById("paymentTitle"),
    pageMessage: document.getElementById("paymentPageMessage"),
    loading: document.getElementById("paymentLoading"),
    content: document.getElementById("paymentContent"),
    instructions: document.getElementById("paymentInstructions"),
    order: document.getElementById("paymentOrder"),
    proofForm: document.getElementById("paymentProofForm"),
    proofFile: document.getElementById("paymentProofFile"),
    proofHelp: document.getElementById("paymentProofHelp"),
    proofMessage: document.getElementById("paymentProofMessage"),
    proofButton: document.getElementById("paymentProofButton"),
    refreshButton: document.getElementById("refreshPaymentButton"),
    actions: document.getElementById("paymentActions"),
    copyButton: document.getElementById("copyPaymentInfoButton"),
    openBankButton: document.getElementById("openBankAppButton"),
    cancelButton: document.getElementById("cancelPaymentButton"),
    bankAppPickerWrap: document.getElementById("bankAppPickerWrap"),
    bankAppSearch: document.getElementById("bankAppSearch"),
    bankAppResults: document.getElementById("bankAppResults"),
      itemsSection: document.getElementById("paymentItemsSection"),
      items: document.getElementById("paymentItems"),
      timelineSection: document.getElementById("paymentTimelineSection"),
      timeline: document.getElementById("paymentTimeline")
  };

  var currentOrder = null;
  var selectedOtherLauncher = null;

  var translations = {
    en: {
      loading: "Loading your secure order...",
      loadFailed: "The payment order could not be loaded.",
      missingToken: "This payment link is incomplete.",
      completePayment: "Complete your payment",
      bankTitle: "Pay by bank transfer",
      zelleTitle: "Pay with Zelle",
      paidTitle: "Payment confirmed",
      order: "Order",
      status: "Status",
      payment: "Payment",
      method: "Payment method",
      reference: "Payment reference",
      total: "Total",
      reservedUntil: "Reserved until",
      bankTransfer: "Bank transfer",
      zelle: "Zelle",
      externalCard: "Card",
      wallet: "Jubielee Account",
      manual_card: "Credit/Debit Card",
      uploadReceipt: "Upload payment receipt",
      chooseFile: "Choose the receipt file first.",
      tooLarge: "The receipt cannot be larger than 15 MB.",
      unsupported: "Upload a JPG, PNG, WEBP, or PDF receipt.",
      uploading: "Uploading receipt...",
      submitReceipt: "Submit receipt",
      replaceReceipt: "Replace receipt",
      receiptHelp: "Receipt upload supports JPG, PNG, WEBP, or PDF up to 15 MB.",
      receiptSubmitted: "Your receipt was submitted and is waiting for Jubielee verification.",
      receiptAlready: "A receipt has already been submitted. Uploading again will replace it.",
      refresh: "Refresh payment status",
      refreshing: "Refreshing...",
      paidMessage: "Payment has been confirmed. Jubielee is preparing the order.",
      pendingReview: "Payment proof received. Jubielee must still verify the funds.",
      finalOrder: "This order can no longer accept payment proof."
    },
    es: {
      loading: "Cargando su orden segura...",
      loadFailed: "No se pudo cargar la orden de pago.",
      missingToken: "Este enlace de pago está incompleto.",
      completePayment: "Complete su pago",
      bankTitle: "Pagar por transferencia bancaria",
      zelleTitle: "Pagar con Zelle",
      paidTitle: "Pago confirmado",
      order: "Orden",
      status: "Estado",
      payment: "Pago",
      method: "Método de pago",
      reference: "Referencia de pago",
      total: "Total",
      reservedUntil: "Reservado hasta",
      bankTransfer: "Transferencia bancaria",
      zelle: "Zelle",
      externalCard: "Tarjeta",
      wallet: "Cuenta Jubielee",
      manual_card: "Tarjeta de crédito/débito",
      uploadReceipt: "Subir comprobante de pago",
      chooseFile: "Seleccione primero el comprobante.",
      tooLarge: "El comprobante no puede superar 15 MB.",
      unsupported: "Suba un comprobante JPG, PNG, WEBP o PDF.",
      uploading: "Subiendo comprobante...",
      submitReceipt: "Enviar comprobante",
      replaceReceipt: "Reemplazar comprobante",
      receiptHelp: "Puede subir JPG, PNG, WEBP o PDF de hasta 15 MB.",
      receiptSubmitted: "Su comprobante fue enviado y está pendiente de verificación por Jubielee.",
      receiptAlready: "Ya se envió un comprobante. Subir otro lo reemplazará.",
      refresh: "Actualizar estado del pago",
      refreshing: "Actualizando...",
      paidMessage: "El pago fue confirmado. Jubielee está preparando la orden.",
      pendingReview: "Comprobante recibido. Jubielee todavía debe verificar los fondos.",
      finalOrder: "Esta orden ya no acepta comprobantes de pago."
    },
    ht: {
      loading: "N ap chaje lòd sekirize ou a...",
      loadFailed: "Nou pa t kapab chaje lòd peman an.",
      missingToken: "Lyen peman sa a pa konplè.",
      completePayment: "Fini peman ou",
      bankTitle: "Peye pa transfè labank",
      zelleTitle: "Peye ak Zelle",
      paidTitle: "Peman konfime",
      order: "Lòd",
      status: "Estati",
      payment: "Peman",
      method: "Metòd peman",
      reference: "Referans peman",
      total: "Total",
      reservedUntil: "Rezève jiska",
      bankTransfer: "Transfè labank",
      zelle: "Zelle",
      externalCard: "Kat",
      wallet: "Kont Jubielee",
      manual_card: "Kat kredi/debi",
      uploadReceipt: "Telechaje resi peman",
      chooseFile: "Chwazi fichye resi a anvan.",
      tooLarge: "Resi a pa ka pi gwo pase 15 MB.",
      unsupported: "Telechaje yon resi JPG, PNG, WEBP oswa PDF.",
      uploading: "N ap telechaje resi a...",
      submitReceipt: "Voye resi",
      replaceReceipt: "Ranplase resi",
      receiptHelp: "Ou ka telechaje JPG, PNG, WEBP oswa PDF jiska 15 MB.",
      receiptSubmitted: "Resi ou a voye epi li ap tann verifikasyon Jubielee.",
      receiptAlready: "Gen yon resi ki deja voye. Yon lòt ap ranplase li.",
      refresh: "Rafrechi estati peman",
      refreshing: "N ap rafrechi...",
      paidMessage: "Peman an konfime. Jubielee ap prepare lòd la.",
      pendingReview: "Resi peman resevwa. Jubielee dwe toujou verifye lajan an.",
      finalOrder: "Lòd sa a pa ka resevwa lòt resi peman."
    },
    fr: {
      loading: "Chargement de votre commande sécurisée...",
      loadFailed: "La commande de paiement n'a pas pu être chargée.",
      missingToken: "Ce lien de paiement est incomplet.",
      completePayment: "Finaliser votre paiement",
      bankTitle: "Payer par virement bancaire",
      zelleTitle: "Payer avec Zelle",
      paidTitle: "Paiement confirmé",
      order: "Commande",
      status: "Statut",
      payment: "Paiement",
      method: "Mode de paiement",
      reference: "Référence de paiement",
      total: "Total",
      reservedUntil: "Réservé jusqu'au",
      bankTransfer: "Virement bancaire",
      zelle: "Zelle",
      externalCard: "Carte",
      wallet: "Compte Jubielee",
      manual_card: "Carte de crédit/débit",
      uploadReceipt: "Téléverser le reçu de paiement",
      chooseFile: "Choisissez d'abord le reçu.",
      tooLarge: "Le reçu ne peut pas dépasser 15 Mo.",
      unsupported: "Téléversez un reçu JPG, PNG, WEBP ou PDF.",
      uploading: "Téléversement du reçu...",
      submitReceipt: "Envoyer le reçu",
      replaceReceipt: "Remplacer le reçu",
      receiptHelp: "Formats acceptés : JPG, PNG, WEBP ou PDF, jusqu'à 15 Mo.",
      receiptSubmitted: "Votre reçu a été envoyé et attend la vérification de Jubielee.",
      receiptAlready: "Un reçu a déjà été envoyé. Le nouveau le remplacera.",
      refresh: "Actualiser le statut du paiement",
      refreshing: "Actualisation...",
      paidMessage: "Le paiement est confirmé. Jubielee prépare la commande.",
      pendingReview: "Reçu reçu. Jubielee doit encore vérifier les fonds.",
      finalOrder: "Cette commande n'accepte plus de reçu de paiement."
    },
    pt: {
      loading: "Carregando seu pedido seguro...",
      loadFailed: "Não foi possível carregar o pedido de pagamento.",
      missingToken: "Este link de pagamento está incompleto.",
      completePayment: "Concluir pagamento",
      bankTitle: "Pagar por transferência bancária",
      zelleTitle: "Pagar com Zelle",
      paidTitle: "Pagamento confirmado",
      order: "Pedido",
      status: "Status",
      payment: "Pagamento",
      method: "Forma de pagamento",
      reference: "Referência de pagamento",
      total: "Total",
      reservedUntil: "Reservado até",
      bankTransfer: "Transferência bancária",
      zelle: "Zelle",
      externalCard: "Cartão",
      wallet: "Conta Jubielee",
      manual_card: "Cartão de crédito/débito",
      uploadReceipt: "Enviar comprovante de pagamento",
      chooseFile: "Escolha primeiro o comprovante.",
      tooLarge: "O comprovante não pode exceder 15 MB.",
      unsupported: "Envie um comprovante JPG, PNG, WEBP ou PDF.",
      uploading: "Enviando comprovante...",
      submitReceipt: "Enviar comprovante",
      replaceReceipt: "Substituir comprovante",
      receiptHelp: "Aceita JPG, PNG, WEBP ou PDF de até 15 MB.",
      receiptSubmitted: "Seu comprovante foi enviado e aguarda verificação da Jubielee.",
      receiptAlready: "Já existe um comprovante. O novo arquivo irá substituí-lo.",
      refresh: "Atualizar status do pagamento",
      refreshing: "Atualizando...",
      paidMessage: "O pagamento foi confirmado. A Jubielee está preparando o pedido.",
      pendingReview: "Comprovante recebido. A Jubielee ainda precisa verificar os fundos.",
      finalOrder: "Este pedido não aceita mais comprovantes."
    }
  };

  var language = preferredLanguage();
  var copy = translations[language] || translations.en;

  document.documentElement.lang = language;
  elements.loading.textContent = copy.loading;
  elements.refreshButton.textContent = copy.refresh;

  function clean(value) {
    return String(value || "").trim();
  }

  function preferredLanguage() {
    var value =
      clean(params.get("language")) ||
      clean(params.get("lang")) ||
      clean(localStorage.getItem("jubielee_pwa_language")) ||
      clean(navigator.language) ||
      "en";

    value = value.toLowerCase().replace(/_/g, "-").split("-")[0];

    return ["en", "es", "ht", "fr", "pt"].indexOf(value) !== -1
      ? value
      : "en";
  }

  async function api(endpoint, options) {
    var opts = options || {};
    var headers = Object.assign(
      { Accept: "application/json" },
      opts.headers || {}
    );

    if (opts.body && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    var response = await fetch(
      API_BASE + "/" + endpoint.replace(/^\/+/, ""),
      {
        method: opts.method || "GET",
        headers: headers,
        body:
          opts.body instanceof FormData
            ? opts.body
            : opts.body
              ? JSON.stringify(opts.body)
              : undefined
      }
    );

    var payload;

    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(copy.loadFailed);
    }

    if (!response.ok || String(payload.status) === "0") {
      throw new Error(payload.msg || copy.loadFailed);
    }

    return payload;
  }

  function money(currency, amount) {
    var value = Number(amount || 0);

    return (
      String(currency || "").toUpperCase() +
      " " +
      (Number.isFinite(value) ? value.toFixed(2) : "0.00")
    );
  }

  function readableStatus(value) {
    return clean(value).replace(/_/g, " ");
  }

  function methodLabel(method) {
    switch (method) {
      case "bank_transfer":
        return copy.bankTransfer;
      case "zelle":
        return copy.zelle;
      case "manual_card":
        return copy.manual_card;
      case "external_card":
        return copy.externalCard;
      case "wallet":
        return copy.wallet;
      default:
        return readableStatus(method);
    }
  }

  function addOrderRow(label, value) {
    var row = document.createElement("div");
    var labelNode = document.createElement("span");
    var valueNode = document.createElement("strong");

    labelNode.textContent = label;
    valueNode.textContent = value;

    row.appendChild(labelNode);
    row.appendChild(valueNode);
    elements.order.appendChild(row);
  }

  function renderItems(order) {
    var items = Array.isArray(order.items) ? order.items : [];
    elements.items.innerHTML = "";
    elements.itemsSection.hidden = items.length === 0;
    items.forEach(function (item) {
      var row = document.createElement("div");
      var description = document.createElement("span");
      var amount = document.createElement("strong");
      description.textContent = String(item.name || "Item") + " × " + String(item.quantity || 0);
      amount.textContent = money(order.currency, item.line_total);
      row.appendChild(description);
      row.appendChild(amount);
      elements.items.appendChild(row);
    });
  }

  function renderTimeline(order) {
    var entries = [];

    if (order.created_at) {
      entries.push({ label: "Order created and inventory reserved", date: order.created_at });
    }

    (order.payment_events || []).forEach(function (event) {
      entries.push({
        label: event.type === "secure_card_submitted"
          ? "Card information received - payment processing"
          : readableStatus(event.type),
        date: event.created_at
      });
    });

    (order.history || []).forEach(function (entry) {
      entries.push({
        label: entry.note || readableStatus(entry.status),
        date: entry.created_at
      });
    });

    entries.sort(function (left, right) {
      return new Date(left.date || 0) - new Date(right.date || 0);
    });

    elements.timeline.innerHTML = "";
    elements.timelineSection.hidden = entries.length === 0;

    entries.forEach(function (entry) {
      var row = document.createElement("div");
      var label = document.createElement("span");
      var date = document.createElement("strong");

      label.textContent = entry.label;
      date.textContent = entry.date
        ? new Date(entry.date).toLocaleString()
        : "";

      row.appendChild(label);
      row.appendChild(date);
      elements.timeline.appendChild(row);
    });
  }

  function canUploadProof(order) {
    return (
      ["bank_transfer", "zelle"].indexOf(order.payment_method) !== -1 &&
      order.payment_status === "awaiting_payment" &&
      order.status === "awaiting_payment"
    );
  }

  function isFinalOrder(order) {
    var orderStatus = String(order.status || "").toLowerCase();
    var paymentStatus = String(order.payment_status || "").toLowerCase();
    var finalStatuses = ["paid", "completed", "cancelled", "canceled", "declined", "expired", "failed", "refunded"];

    return finalStatuses.indexOf(orderStatus) !== -1 ||
      finalStatuses.indexOf(paymentStatus) !== -1;
  }

  // JUBIELEE_STORE_BANK_TRANSFER_ROUTING_V1
  function bankTransferInstruction() {
    var messages = {
      en:
        "Transfer the exact amount to the account shown below, use the payment reference, then upload your receipt.",
      es:
        "Realice la transferencia por el monto exacto a la cuenta indicada abajo, use la referencia de pago y luego suba su comprobante.",
      ht:
        "Fè transfè a pou montan egzak la nan kont ki anba a, sèvi ak referans peman an, epi telechaje resi a.",
      fr:
        "Effectuez le virement du montant exact vers le compte indiqué ci-dessous, utilisez la référence de paiement, puis téléversez votre reçu.",
      pt:
        "Faça a transferência do valor exato para a conta abaixo, use a referência de pagamento e depois envie o comprovante."
    };

    return messages[language] || messages.en;
  }

  function receivingBankLabels() {
    var labels = {
      en: {
        amount: "Amount to transfer",
        bank: "Bank",
        holder: "Account holder",
        rnc: "RNC",
        type: "Account type",
        number: "Account number",
        currency: "Currency",
        routed: "Routing"
      },
      es: {
        amount: "Monto a transferir",
        bank: "Banco",
        holder: "Titular",
        rnc: "RNC",
        type: "Tipo de cuenta",
        number: "Número de cuenta",
        currency: "Moneda",
        routed: "Enrutamiento"
      },
      ht: {
        amount: "Montan pou transfere",
        bank: "Bank",
        holder: "Titilè kont",
        rnc: "RNC",
        type: "Kalite kont",
        number: "Nimewo kont",
        currency: "Lajan",
        routed: "Wout peman"
      },
      fr: {
        amount: "Montant à virer",
        bank: "Banque",
        holder: "Titulaire",
        rnc: "RNC",
        type: "Type de compte",
        number: "Numéro de compte",
        currency: "Devise",
        routed: "Acheminement"
      },
      pt: {
        amount: "Valor a transferir",
        bank: "Banco",
        holder: "Titular",
        rnc: "RNC",
        type: "Tipo de conta",
        number: "Número da conta",
        currency: "Moeda",
        routed: "Roteamento"
      }
    };

    return labels[language] || labels.en;
  }

  function addReceivingBankRows(order) {
    if (
      !order ||
      order.payment_method !== "bank_transfer" ||
      !order.receiving_bank
    ) {
      return;
    }

    var bank = order.receiving_bank;
    var labels = receivingBankLabels();

    addOrderRow(
      labels.amount,
      money(bank.currency, bank.amount)
    );

    addOrderRow(labels.bank, clean(bank.bank_name));
    addOrderRow(labels.holder, clean(bank.account_holder));
    addOrderRow(labels.rnc, clean(bank.rnc));
    addOrderRow(labels.type, clean(bank.account_type_label));
    addOrderRow(labels.number, clean(bank.account_number));
    addOrderRow(labels.currency, clean(bank.currency));

    if (bank.used_fallback) {
      addOrderRow(
        labels.routed,
        "BanReservas"
      );
    }
  }

  // JUBIELEE_STORE_PAYMENT_CONTINUITY_V1
  function actionLabels() {
    var labels = {
      en: {
        copy: "Copy transfer information",
        copied: "Transfer information copied.",
        open: "Open %s App",
        search: "Find your banking app",
        cancel: "Cancel Order & Return to Store",
        cancelConfirm:
          "Cancel this order and release the reserved item?",
        cancelDone:
          "Order cancelled. Returning to JubieStore...",
        noLauncher:
          "Choose a bank from the search results first."
      },
      es: {
        copy: "Copiar información de transferencia",
        copied: "Información de transferencia copiada.",
        open: "Abrir app de %s",
        search: "Busque su aplicación bancaria",
        cancel: "Cancelar orden y volver a la tienda",
        cancelConfirm:
          "¿Cancelar esta orden y liberar el artículo reservado?",
        cancelDone:
          "Orden cancelada. Regresando a JubieStore...",
        noLauncher:
          "Seleccione primero un banco de los resultados."
      },
      ht: {
        copy: "Kopye enfòmasyon transfè a",
        copied: "Enfòmasyon transfè a kopye.",
        open: "Louvri aplikasyon %s",
        search: "Chèche aplikasyon bank ou",
        cancel: "Anile lòd la epi retounen nan magazen an",
        cancelConfirm:
          "Anile lòd sa a epi lage atik ki te rezève a?",
        cancelDone:
          "Lòd anile. N ap retounen nan JubieStore...",
        noLauncher:
          "Chwazi yon bank nan rezilta yo anvan."
      },
      fr: {
        copy: "Copier les informations du virement",
        copied: "Informations du virement copiées.",
        open: "Ouvrir l’app %s",
        search: "Rechercher votre application bancaire",
        cancel: "Annuler la commande et retourner à la boutique",
        cancelConfirm:
          "Annuler cette commande et libérer l’article réservé ?",
        cancelDone:
          "Commande annulée. Retour à JubieStore...",
        noLauncher:
          "Choisissez d’abord une banque dans les résultats."
      },
      pt: {
        copy: "Copiar informações da transferência",
        copied: "Informações da transferência copiadas.",
        open: "Abrir app %s",
        search: "Procure seu aplicativo bancário",
        cancel: "Cancelar pedido e voltar à loja",
        cancelConfirm:
          "Cancelar este pedido e liberar o item reservado?",
        cancelDone:
          "Pedido cancelado. Voltando à JubieStore...",
        noLauncher:
          "Escolha primeiro um banco nos resultados."
      }
    };

    return labels[language] || labels.en;
  }

  function saveCurrentOrder(order) {
    try {
      localStorage.setItem(
        "jubielee_store_last_order",
        JSON.stringify(order)
      );
    } catch (error) {
      // Order still works from its secure URL.
    }
  }

  function transferCopyText(order) {
    if (!order || !order.receiving_bank) {
      return "";
    }

    var bank = order.receiving_bank;

    return [
      "JubieStore Bank Transfer",
      "",
      "Amount: " + money(bank.currency, bank.amount),
      "Bank: " + clean(bank.bank_name),
      "Account holder: " + clean(bank.account_holder),
      "RNC: " + clean(bank.rnc),
      "Account type: " + clean(bank.account_type_label),
      "Account number: " + clean(bank.account_number),
      "Currency: " + clean(bank.currency),
      "Reference: " +
        clean(bank.reference || order.payment_reference)
    ].join("\n");
  }

  function copyTransferInfo(order) {
    var text = transferCopyText(order);

    if (!text) {
      return;
    }

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      navigator.clipboard.writeText(text).catch(function () {});
      return;
    }

    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
    } catch (error) {}

    textarea.remove();
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }

  function httpsPlayStoreUrl(launcher) {
    var packageName = clean(
      launcher && launcher.android_package
    );

    if (!packageName) {
      return "";
    }

    return (
      "https://play.google.com/store/apps/details?id=" +
      encodeURIComponent(packageName)
    );
  }

  function launcherTarget(launcher) {
    if (!launcher) {
      return "";
    }

    if (isAndroid()) {
      if (clean(launcher.android_deep_link)) {
        return clean(launcher.android_deep_link);
      }

      if (clean(launcher.android_package)) {
        var fallback =
          httpsPlayStoreUrl(launcher) ||
          clean(launcher.web_fallback_url);

        return (
          "intent://#Intent;" +
          "package=" +
          clean(launcher.android_package) +
          ";" +
          (
            fallback
              ? "S.browser_fallback_url=" +
                encodeURIComponent(fallback) +
                ";"
              : ""
          ) +
          "end"
        );
      }

      return (
        clean(launcher.web_fallback_url) ||
        clean(launcher.android_play_store_url)
      );
    }

    if (isIOS()) {
      return (
        clean(launcher.ios_scheme) ||
        clean(launcher.ios_universal_link) ||
        clean(launcher.ios_app_store_url) ||
        clean(launcher.web_fallback_url)
      );
    }

    return (
      clean(launcher.web_fallback_url) ||
      httpsPlayStoreUrl(launcher) ||
      clean(launcher.ios_app_store_url)
    );
  }

  function currentLauncher() {
    if (selectedOtherLauncher) {
      return selectedOtherLauncher;
    }

    if (currentOrder && currentOrder.bank_launcher) {
      return currentOrder.bank_launcher;
    }

    return null;
  }

  function updateOpenBankButton() {
    var labels = actionLabels();
    var launcher = currentLauncher();
    var target = launcherTarget(launcher);

    if (!launcher || !target) {
      elements.openBankButton.hidden = true;
      return;
    }

    elements.openBankButton.hidden = false;
    elements.openBankButton.textContent =
      labels.open.replace(
        "%s",
        clean(launcher.display_name) || "Bank"
      );
  }

  function renderBankAppSearchResults(query) {
    if (!currentOrder) {
      return;
    }

    var options = Array.isArray(
      currentOrder.bank_launch_options
    )
      ? currentOrder.bank_launch_options
      : [];

    var search = clean(query).toLowerCase();

    var matches = options.filter(function (item) {
      var haystack = [
        item.display_name,
        item.bank_key
      ].join(" ").toLowerCase();

      return !search || haystack.indexOf(search) !== -1;
    }).slice(0, 10);

    elements.bankAppResults.innerHTML = "";

    matches.forEach(function (launcher) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ghost-button full-width";
      button.textContent =
        clean(launcher.display_name) || "Bank";

      button.addEventListener("click", function () {
        selectedOtherLauncher = launcher;
        elements.bankAppSearch.value =
          clean(launcher.display_name);

        elements.bankAppResults.innerHTML = "";
        updateOpenBankButton();
      });

      elements.bankAppResults.appendChild(button);
    });
  }

  function configurePaymentActions(order) {
    var isBankTransfer =
      order.payment_method === "bank_transfer" &&
      order.receiving_bank;

    elements.copyButton.hidden = !isBankTransfer;
    elements.cancelButton.hidden =
      !Boolean(order.can_customer_cancel);

    selectedOtherLauncher = null;

    var options = Array.isArray(order.bank_launch_options)
      ? order.bank_launch_options
      : [];

    elements.bankAppPickerWrap.hidden =
      !isBankTransfer || options.length === 0;

    elements.bankAppSearch.value = "";
    elements.bankAppResults.innerHTML = "";

    if (options.length > 0) {
      renderBankAppSearchResults("");
    }

    updateOpenBankButton();

    elements.actions.hidden =
      elements.copyButton.hidden &&
      elements.openBankButton.hidden &&
      elements.cancelButton.hidden &&
      elements.bankAppPickerWrap.hidden;
  }

  function renderOrder(order) {
    currentOrder = order;
    saveCurrentOrder(order);

    var paid = order.payment_status === "paid";
    var proofAllowed = canUploadProof(order);

    elements.loading.hidden = true;
    elements.content.hidden = false;
    elements.pageMessage.textContent = "";

    if (paid) {
      elements.title.textContent = copy.paidTitle;
      elements.instructions.textContent = copy.paidMessage;
    } else if (
      ["external_card", "manual_card"].indexOf(order.payment_method) !== -1 &&
      order.payment_status === "processing"
    ) {
      elements.title.textContent = readableStatus(order.payment_status);
      elements.instructions.textContent = "Card payment is being reviewed.";
    } else if (order.payment_method === "bank_transfer") {
      elements.title.textContent = copy.bankTitle;
      elements.instructions.textContent =        bankTransferInstruction();
    } else if (order.payment_method === "zelle") {
      elements.title.textContent = copy.zelleTitle;
      elements.instructions.textContent =
        order.payment_instructions || copy.completePayment;
    } else {
      elements.title.textContent = copy.completePayment;
      elements.instructions.textContent =
        order.payment_instructions || copy.completePayment;
    }

    elements.order.innerHTML = "";

    addOrderRow(copy.order, order.order_number || "—");
    addOrderRow(copy.status, readableStatus(order.status));
    addOrderRow(copy.payment, readableStatus(order.payment_status));
    addOrderRow(copy.method, methodLabel(order.payment_method));
    addReceivingBankRows(order);
    addOrderRow(copy.reference, order.payment_reference || "—");
    addOrderRow(copy.total, money(order.currency, order.total_amount));

    renderItems(order);
    renderTimeline(order);
    configurePaymentActions(order);

    if (order.reserved_until) {
      addOrderRow(
        copy.reservedUntil,
        new Date(order.reserved_until).toLocaleString()
      );
    }

    elements.proofForm.hidden = !proofAllowed;

    if (proofAllowed) {
      elements.proofHelp.textContent = order.payment_proof_received
        ? copy.receiptAlready
        : copy.receiptHelp;

      elements.proofButton.textContent = order.payment_proof_received
        ? copy.replaceReceipt
        : copy.submitReceipt;

      if (order.payment_proof_received) {
        elements.pageMessage.textContent = copy.pendingReview;
      }
    } else if (!paid && isFinalOrder(order)) {
      elements.pageMessage.textContent = copy.finalOrder;
    }
  }

  async function loadOrder() {
    if (!checkoutToken) {
      elements.loading.hidden = true;
      elements.pageMessage.textContent = copy.missingToken;
      return;
    }

    try {
      var result = await api(
        "store/orders/" + encodeURIComponent(checkoutToken)
      );

      renderOrder(result.data);
    } catch (error) {
      elements.loading.hidden = true;
      elements.pageMessage.textContent = error.message;
    }
  }

  function startAutomaticRefresh() {
    window.setInterval(function () {
      if (!document.hidden && currentOrder && !isFinalOrder(currentOrder)) {
        loadOrder();
      }
    }, 10000);
  }

  elements.copyButton.addEventListener(
    "click",
    function () {
      if (!currentOrder) {
        return;
      }

      copyTransferInfo(currentOrder);
      elements.pageMessage.textContent =
        actionLabels().copied;
    }
  );

  elements.openBankButton.addEventListener(
    "click",
    function () {
      if (!currentOrder) {
        return;
      }

      var launcher = currentLauncher();

      if (!launcher) {
        elements.pageMessage.textContent =
          actionLabels().noLauncher;
        return;
      }

      var target = launcherTarget(launcher);

      if (!target) {
        elements.pageMessage.textContent =
          actionLabels().noLauncher;
        return;
      }

      // Copy the exact payment instructions before leaving
      // the browser for the banking application.
      copyTransferInfo(currentOrder);

      window.location.href = target;
    }
  );

  elements.bankAppSearch.addEventListener(
    "input",
    function () {
      selectedOtherLauncher = null;
      updateOpenBankButton();
      renderBankAppSearchResults(
        elements.bankAppSearch.value
      );
    }
  );

  elements.cancelButton.addEventListener(
    "click",
    async function () {
      if (
        !currentOrder ||
        !currentOrder.can_customer_cancel
      ) {
        return;
      }

      var labels = actionLabels();

      if (!window.confirm(labels.cancelConfirm)) {
        return;
      }

      elements.cancelButton.disabled = true;

      try {
        await api(
          "store/orders/" +
            encodeURIComponent(
              currentOrder.checkout_token
            ) +
            "/cancel",
          {
            method: "POST"
          }
        );

        localStorage.removeItem(
          "jubielee_store_last_order"
        );

        elements.pageMessage.textContent =
          labels.cancelDone;

        window.setTimeout(function () {
          window.location.assign("index.html");
        }, 500);
      } catch (error) {
        elements.pageMessage.textContent =
          error.message;
        elements.cancelButton.disabled = false;
      }
    }
  );

  document.addEventListener(
    "visibilitychange",
    function () {
      if (
        !document.hidden &&
        currentOrder &&
        !isFinalOrder(currentOrder)
      ) {
        loadOrder();
      }
    }
  );

  window.addEventListener("focus", function () {
    if (
      currentOrder &&
      !isFinalOrder(currentOrder)
    ) {
      window.setTimeout(loadOrder, 250);
    }
  });

  elements.proofForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    var file =
      elements.proofFile.files && elements.proofFile.files[0]
        ? elements.proofFile.files[0]
        : null;

    elements.proofMessage.textContent = "";

    if (!file) {
      elements.proofMessage.textContent = copy.chooseFile;
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      elements.proofMessage.textContent = copy.tooLarge;
      return;
    }

    var supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ];

    if (
      file.type &&
      supportedTypes.indexOf(file.type.toLowerCase()) === -1
    ) {
      elements.proofMessage.textContent = copy.unsupported;
      return;
    }

    var formData = new FormData();
    formData.append("proof", file);

    elements.proofButton.disabled = true;
    elements.proofButton.textContent = copy.uploading;

    try {
      var result = await api(
        "store/orders/" +
          encodeURIComponent(currentOrder.checkout_token) +
          "/payment-proof",
        {
          method: "POST",
          body: formData
        }
      );

      renderOrder(result.data);
      elements.pageMessage.textContent = copy.receiptSubmitted;
      elements.proofFile.value = "";
    } catch (error) {
      elements.proofMessage.textContent = error.message;
    } finally {
      elements.proofButton.disabled = false;

      if (currentOrder) {
        elements.proofButton.textContent =
          currentOrder.payment_proof_received
            ? copy.replaceReceipt
            : copy.submitReceipt;
      }
    }
  });

  elements.refreshButton.addEventListener("click", async function () {
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = copy.refreshing;

    try {
      await loadOrder();
    } finally {
      elements.refreshButton.disabled = false;
      elements.refreshButton.textContent = copy.refresh;
    }
  });

  loadOrder();
  startAutomaticRefresh();
})();
