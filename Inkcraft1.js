document.addEventListener('DOMContentLoaded', () => {
  const content = document.querySelector('.content');
  setTimeout(() => {
    content.classList.add('visible');
  }, 300); // slight delay for smoother load
});
