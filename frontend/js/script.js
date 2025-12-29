// API Base URL - Update this with your deployed backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-render-backend.onrender.com';

// Initialize EmailJS
emailjs.init(import.meta.env.VITE_EMAILJS_USER_ID || "YOUR_EMAILJS_USER_ID");

// Counter animation functionality
function animateCounters() {
  const counters = document.querySelectorAll('.counter');
  const duration = 2000; // Animation duration in milliseconds

  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    const start = +counter.innerText;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (target - start) * progress);

      counter.innerText = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        counter.innerText = target.toLocaleString();
      }
    };

    requestAnimationFrame(animate);
  });
}

// Amount selection functionality
document.addEventListener('DOMContentLoaded', function() {
  // Animate counters on page load
  animateCounters();

  const amountCards = document.querySelectorAll('.amount-card:not(#customAmountCard)');
  const amountInput = document.getElementById('amount');

  amountCards.forEach(card => {
    card.addEventListener('click', function() {
      // Remove selected class from all cards
      amountCards.forEach(c => c.classList.remove('selected'));
      document.getElementById('customAmountCard').classList.remove('selected');
      // Add selected class to clicked card
      this.classList.add('selected');
      // Set the amount in the input field
      const selectedAmount = this.getAttribute('data-amount');
      amountInput.value = selectedAmount;
    });
  });

  // Update selected card when input changes
  amountInput.addEventListener('input', function() {
    const inputValue = parseInt(this.value);
    amountCards.forEach(card => {
      const cardAmount = parseInt(card.getAttribute('data-amount'));
      if (cardAmount === inputValue) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  });

  // Handle custom amount input
  const customAmountInput = document.getElementById('customAmount');
  customAmountInput.addEventListener('input', function() {
    const customValue = parseInt(this.value);
    if (customValue >= 1000 && customValue <= 50000) {
      amountInput.value = customValue;
      // Select the custom amount card
      amountCards.forEach(c => c.classList.remove('selected'));
      document.getElementById('customAmountCard').classList.add('selected');
    } else {
      amountInput.value = '';
      document.getElementById('customAmountCard').classList.remove('selected');
    }
  });

  // Phone number formatting
  const phoneInput = document.getElementById('phone');
  phoneInput.addEventListener('blur', function() {
    let phoneNumber = this.value.replace(/\s+/g, ''); // Remove spaces

    // If user entered 9 digits, prepend 254
    if (/^[0-9]{9}$/.test(phoneNumber)) {
      phoneNumber = `254${phoneNumber}`;
      this.value = phoneNumber;
    }
    // If user entered 12 digits starting with 254, keep as is
    else if (!/^254[0-9]{9}$/.test(phoneNumber)) {
      // Invalid format - could show error but for now just leave as is
      // The server will validate and provide proper error message
    }
  });

  // Also format on input to provide immediate feedback
  phoneInput.addEventListener('input', function() {
    let phoneNumber = this.value.replace(/\s+/g, '');

    // Auto-format as user types
    if (phoneNumber.length === 9 && /^[0-9]{9}$/.test(phoneNumber)) {
      // Don't auto-prepend while typing, wait for blur event
    } else if (phoneNumber.length === 12 && /^254[0-9]{9}$/.test(phoneNumber)) {
      // Valid format, no change needed
    }
  });
});

document.getElementById('loanForm').addEventListener('submit', function(event) {
  event.preventDefault();

  const formData = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    amount: document.getElementById('amount').value,
    purpose: document.getElementById('purpose').value
  };

  // Validate amount
  const amount = parseInt(formData.amount);
  if (!formData.amount || isNaN(amount) || amount < 1000 || amount > 50000) {
    alert('Please select or enter a valid loan amount between KES 1,000 and 50,000.');
    return;
  }

  // Submit application to server
  fetch(`${API_BASE_URL}/api/submit-application`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Application submitted:', data);
    if (data.applicationId) {
      // Initiate payment
      initiatePayment(data.applicationId, formData.phone);
    } else {
      alert('Failed to submit application. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error submitting application:', error);
    alert('Failed to submit application. Please try again.');
  });
});

function initiatePayment(applicationId, phone) {
  fetch(`${API_BASE_URL}/initiate-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ applicationId: applicationId, phone: phone }),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Payment initiated:', data);
    if (data.message) {
      alert(data.message + ' Please check your phone for the M-Pesa prompt.');
    } else {
      alert('Payment initiation failed. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error initiating payment:', error);
    alert('Failed to initiate payment. Please try again.');
  });
}
