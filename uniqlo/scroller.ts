const scroller = document.querySelector('.scroller');


// Find all the scroll snap items
scroller?.addEventListener('scrollsnapchanging', (e) => {
  document.querySelector('a.active')?.classList.remove('active');
  document.querySelector(`a[href="#${e.snapTargetBlock.id}"]`)?.classList.add('active');
})
