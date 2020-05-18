import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (products.length > findProducts.length) {
      throw new AppError('Product not found');
    }

    const productsToUpdateQuantity: Product[] = [];

    const mappedProdutcs = findProducts.map(product => {
      const currentStock = product.quantity;
      const orderedProduct = products.find(order => order.id === product.id);

      if (!orderedProduct) {
        throw new AppError('Product not found');
      }

      if (currentStock < orderedProduct.quantity) {
        throw new AppError('Insuficient quantity.');
      }

      productsToUpdateQuantity.push({
        ...product,
        id: product.id,
        quantity: product.quantity - orderedProduct.quantity,
      });

      return {
        product_id: product.id,
        price: product.price,
        quantity: orderedProduct.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: mappedProdutcs,
    });

    await this.productsRepository.updateQuantity(productsToUpdateQuantity);

    return order;
  }
}

export default CreateProductService;
