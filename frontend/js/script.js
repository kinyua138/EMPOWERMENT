 // API Base URL - Update this with your deployed backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://empowerment.onrender.com';

// Initialize EmailJS
emailjs.init(import.meta.env.VITE_EMAILJS_USER_ID || "YOUR_EMAILJS_USER_ID");

console.log('Script loaded');

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

// Amount selection functionality - moved outside DOMContentLoaded since script loads at bottom
const amountCards = document.querySelectorAll('.amount-card');
const amountInput = document.getElementById('amount');

console.log('Amount cards found:', amountCards.length);
console.log('Amount input found:', amountInput);

amountCards.forEach(card => {
  card.addEventListener('click', function() {
    console.log('Amount card clicked:', this.getAttribute('data-amount'));
    // Remove selected class from all cards
    amountCards.forEach(c => c.classList.remove('selected'));
    // Add selected class to clicked card
    this.classList.add('selected');
    // Set the amount in the input field
    const selectedAmount = this.getAttribute('data-amount');
    amountInput.value = selectedAmount;
    console.log('Amount set to:', selectedAmount);
  });
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

// Animate counters on page load
document.addEventListener('DOMContentLoaded', function() {
  animateCounters();
});

// Form submission handler - attached immediately since script loads at bottom
const loanForm = document.getElementById('loanForm');
const submitBtn = document.getElementById('submitBtn');
console.log('Form element found:', loanForm);
console.log('Submit button found:', submitBtn);

if (loanForm) {
  loanForm.addEventListener('submit', function(event) {
    console.log('Submit event captured, preventing default');
    event.preventDefault();
    event.stopPropagation(); // Stop event bubbling
    event.stopImmediatePropagation(); // Stop other listeners
    console.log('Form submit event triggered');
    return false; // Additional prevention

  const formData = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    amount: document.getElementById('amount').value,
    purpose: document.getElementById('purpose').value
  };

  console.log('Form data collected:', formData);

  // Validate amount
  const amount = parseInt(formData.amount);
  if (!formData.amount || isNaN(amount) || amount < 1000 || amount > 50000) {
    alert('Please select or enter a valid loan amount between KES 1,000 and 50,000.');
    console.log('Amount validation failed:', formData.amount);
    return;
  }

  // Set button to loading state
  setButtonLoading(true);

  console.log('Submitting application to:', `${API_BASE_URL}/api/submit-application`);

  // Submit application to server
  fetch(`${API_BASE_URL}/api/submit-application`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  })
  .then(response => {
    console.log('Submit application response status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Application submitted successfully:', data);
    if (data.applicationId) {
      // Initiate payment
      initiatePayment(data.applicationId, formData.phone);
    } else {
      setButtonLoading(false);
      alert('Failed to submit application. Please try again.');
      console.error('No applicationId in response:', data);
    }
  })
  .catch(error => {
    console.error('Error submitting application:', error);
    setButtonLoading(false);
    alert('Failed to submit application. Please check your connection and try again.');
  });
  });
} else {
  console.error('Form element not found!');
}

function setButtonLoading(isLoading) {
  const submitBtn = document.getElementById('submitBtn');
  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Submit Application';
  }
}

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
    setButtonLoading(false); // Reset button after payment initiation
    if (data.message) {
      alert(data.message + ' Please check your phone for the M-Pesa prompt.');
    } else {
      alert('Payment initiation failed. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error initiating payment:', error);
    setButtonLoading(false); // Reset button on error
    alert('Failed to initiate payment. Please try again.');
  });
}
